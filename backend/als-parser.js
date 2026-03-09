const fs = require('fs');
const zlib = require('zlib');
const xml2js = require('xml2js');

/**
 * Parses an Ableton Live Set (.als) file and extracts metadata.
 * @param {string} filePath Path to the .als file.
 * @return {Promise<Object>} Extracted metadata.
 */
async function parseAls(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const gzippedData = fs.readFileSync(filePath);
      zlib.gunzip(gzippedData, (err, decompressedData) => {
        if (err) {
          // If gunzip fails, it might not be gzipped or it's empty
          return resolve({ error: 'Failed to decompress .als file (file might be empty or corrupt)' });
        }

        const parser = new xml2js.Parser({ explicitArray: false });
        parser.parseString(decompressedData, (err, result) => {
          if (err) {
            return reject(new Error(`Failed to parse XML: ${err.message}`));
          }

          // Extract relevant details
          const liveSet = result?.Ableton?.LiveSet;
          if (!liveSet) {
            return resolve({ error: 'Invalid Ableton file structure' });
          }

          // 1. IMPROVED TEMPO DETECTION
          let tempo = 'Unknown';
          try {
            // Traverse the tree looking for a 'Tempo' node with a 'Value'
            const findTempo = (obj) => {
              if (!obj || typeof obj !== 'object') return null;
              if (obj.Tempo && obj.Tempo.Manual && obj.Tempo.Manual['$'] && obj.Tempo.Manual['$'].Value) {
                return obj.Tempo.Manual['$'].Value;
              }
              if (obj.Tempo && obj.Tempo['$'] && obj.Tempo['$'].Value) {
                return obj.Tempo['$'].Value;
              }
              for (const key in obj) {
                const res = findTempo(obj[key]);
                if (res) return res;
              }
              return null;
            };
            
            const foundTempo = findTempo(liveSet);
            if (foundTempo) tempo = parseFloat(foundTempo);
          } catch (e) {
            console.warn('Tempo search failed:', e.message);
          }

          // 2. FILTERED TRACK COUNT
          let trackCount = 0;
          let audioTracks = 0;
          let midiTracks = 0;
          
          if (liveSet.Tracks) {
            const tracks = liveSet.Tracks;
            if (tracks.AudioTrack) {
                audioTracks = Array.isArray(tracks.AudioTrack) ? tracks.AudioTrack.length : 1;
            }
            if (tracks.MidiTrack) {
                midiTracks = Array.isArray(tracks.MidiTrack) ? tracks.MidiTrack.length : 1;
            }
            trackCount = audioTracks + midiTracks;
          }

          const metadata = {
            tempo: (typeof tempo === 'number' && !isNaN(tempo)) ? Math.round(tempo * 100) / 100 : 'Unknown',
            trackCount: trackCount,
            audioTracks,
            midiTracks,
            creator: result?.Ableton?.['$']?.Creator || 'Unknown',
            majorVersion: result?.Ableton?.['$']?.MajorVersion || '?',
            minorVersion: result?.Ableton?.['$']?.MinorVersion || '?',
            schemaVersion: result?.Ableton?.['$']?.SchemaVersion || '?'
          };

          resolve(metadata);
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { parseAls };
