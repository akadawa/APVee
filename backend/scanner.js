const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { parseAls } = require('./als-parser');

class ProjectScanner {
    constructor(musicDir) {
        this.musicDir = musicDir;
        this.projects = [];
        this.watcher = null;
    }

    async scan() {
        console.log(`Starting deep scan of ${this.musicDir}...`);
        const projects = [];
        const skipFolders = ['Backup', 'Ableton Project Info', 'Remote Scripts', 'Presets', 'Samples', 'User Library', 'Core Library', 'Factory Packs', 'Plug-ins', 'Thumbnails', 'Crash Recovery'];

        const findProjects = async (dir) => {
            let files;
            try {
                files = fs.readdirSync(dir);
            } catch (err) {
                console.error(`Cannot read directory ${dir}: ${err.message}`);
                return;
            }

            let hasAls = false;
            let projectFiles = [];

            for (const file of files) {
                if (file.startsWith('.') || file.startsWith('_')) continue;
                const fullPath = path.join(dir, file);

                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        if (skipFolders.includes(file) || file.endsWith(' Project Info')) continue;
                        await findProjects(fullPath);
                    } else if (file.endsWith('.als')) {
                        hasAls = true;
                        projectFiles.push(fullPath);
                    }
                } catch (err) {
                    // Skip files that can't be stat-ed (e.g. permission issues)
                    continue;
                }
            }

            if (hasAls) {
                try {
                    const exports = this.findExports(dir);
                    const alsMetadata = await parseAls(projectFiles[0]);

                    // Get latest modification time for the project
                    let projectMtime = fs.statSync(dir).mtime;
                    for (const alsFile of projectFiles) {
                        const m = fs.statSync(alsFile).mtime;
                        if (m > projectMtime) projectMtime = m;
                    }

                    const project = {
                        name: path.basename(dir),
                        path: dir,
                        mtime: projectMtime,
                        relativeDir: path.relative(this.musicDir, dir),
                        exports: exports.sort((a, b) => b.mtime - a.mtime),
                        metadata: alsMetadata
                    };
                    projects.push(project);
                    console.log(`[+] Found Project: ${project.name} (${project.exports.length} exports)`);
                    this.projects = [...projects]; // Update in real-time
                } catch (err) {
                    console.error(`Error processing project ${dir}: ${err.message}`);
                }
            }
        };

        try {
            await findProjects(this.musicDir);
            console.log(`Scan complete. Found ${projects.length} projects.`);
            this.projects = projects;
            return this.projects;
        } catch (error) {
            console.error('Core scan error:', error);
            return this.projects;
        }
    }

    findExports(projectDir) {
        const exports = [];
        const allowedExtensions = ['.mp3', '.wav'];
        const minSizeBytes = 1 * 1024 * 1024; // 1MB minimum to skip short samples

        const targetDirs = ['Bounce', 'Master', 'Preview'];

        const walk = (dir) => {
            let files;
            try {
                files = fs.readdirSync(dir);
            } catch (e) { return; }

            for (const file of files) {
                const fullPath = path.join(dir, file);
                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        walk(fullPath);
                    } else if (allowedExtensions.includes(path.extname(file).toLowerCase())) {
                        if (stat.size >= minSizeBytes) {
                            exports.push({
                                name: file,
                                path: fullPath,
                                mtime: stat.mtime,
                                size: stat.size
                            });
                        }
                    }
                } catch (e) { continue; }
            }
        };

        for (const dirName of targetDirs) {
            const checkDir = path.join(projectDir, dirName);
            if (fs.existsSync(checkDir) && fs.statSync(checkDir).isDirectory()) {
                walk(checkDir);
            }
        }

        return exports;
    }

    startWatching() {
        this.watcher = chokidar.watch(this.musicDir, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true
        });

        this.watcher.on('all', (event, path) => {
            console.log(`File change detected: ${event} on ${path}. Rescanning...`);
            this.scan();
        });
    }

    getProjects() {
        return this.projects;
    }
}

module.exports = ProjectScanner;
