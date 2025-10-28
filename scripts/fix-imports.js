/**
 * 🔧 Auto-fix Import Paths Script
 * Automatically fixes all import paths after feature migration
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

class ImportPathFixer {
    constructor() {
        this.fixedFiles = [];
        this.errors = [];
    }

    async fixAllImports() {
        console.log('🔧 Starting auto-fix of import paths...\n');

        try {
            // Fix imports in features directory
            await this.processDirectory(path.join(projectRoot, 'features'));
            
            // Fix imports in shared directory
            await this.processDirectory(path.join(projectRoot, 'shared'));

            this.printSummary();
        } catch (error) {
            console.error('❌ Error during import fix:', error);
        }
    }

    async processDirectory(dirPath) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                await this.processDirectory(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                await this.fixImportsInFile(fullPath);
            }
        }
    }

    async fixImportsInFile(filePath) {
        try {
            let content = await fs.readFile(filePath, 'utf8');
            const originalContent = content;

            // Determine relative path to project root
            const relativePath = path.relative(path.dirname(filePath), projectRoot);
            const sharedPath = path.join(relativePath, 'shared').replace(/\\/g, '/');

            // Fix patterns for shared imports
            const fixes = [
                // Fix middleware imports
                {
                    pattern: /from\s+['"]\.\.\/(middleware\/[^'"]+)['"]/g,
                    replacement: `from '${sharedPath}/$1'`
                },
                {
                    pattern: /from\s+['"]\.\.\.\/(middleware\/[^'"]+)['"]/g,
                    replacement: `from '${sharedPath}/$1'`
                },
                
                // Fix service imports
                {
                    pattern: /from\s+['"]\.\.\/(services\/[^'"]+)['"]/g,
                    replacement: `from '${sharedPath}/$1'`
                },
                {
                    pattern: /from\s+['"]\.\.\.\/(services\/[^'"]+)['"]/g,
                    replacement: `from '${sharedPath}/$1'`
                },
                
                // Fix utils imports
                {
                    pattern: /from\s+['"]\.\.\/(utils\/[^'"]+)['"]/g,
                    replacement: `from '${sharedPath}/$1'`
                },
                {
                    pattern: /from\s+['"]\.\.\.\/(utils\/[^'"]+)['"]/g,
                    replacement: `from '${sharedPath}/$1'`
                },

                // Fix constants imports
                {
                    pattern: /from\s+['"]\.\.\/(constants\/[^'"]+)['"]/g,
                    replacement: `from '${sharedPath}/$1'`
                },
                {
                    pattern: /from\s+['"]\.\.\.\/(constants\/[^'"]+)['"]/g,
                    replacement: `from '${sharedPath}/$1'`
                },

                // Fix controller imports within features
                {
                    pattern: /from\s+['"]\.\.\/(controllers\/[^'"]+)['"]/g,
                    replacement: `from '${relativePath}/$1'`.replace(/\\/g, '/')
                }
            ];

            let hasChanges = false;

            for (const fix of fixes) {
                if (fix.pattern.test(content)) {
                    content = content.replace(fix.pattern, fix.replacement);
                    hasChanges = true;
                }
            }

            // Special fixes for specific patterns
            
            // Fix authMiddleware destructuring
            content = content.replace(
                /import\s+authMiddleware\s+from\s+['"]([^'"]+authMiddleware\.js)['"];?/g,
                "import { authMiddleware } from '$1';"
            );

            // Fix relative paths to be consistent
            content = content.replace(
                /from\s+['"]\.\/\.\.\/(shared\/[^'"]+)['"]/g,
                `from '../$1'`
            );

            if (hasChanges || content !== originalContent) {
                await fs.writeFile(filePath, content, 'utf8');
                this.fixedFiles.push(filePath);
                
                const relativePath = path.relative(projectRoot, filePath);
                console.log(`✅ Fixed: ${relativePath}`);
            }

        } catch (error) {
            this.errors.push({ file: filePath, error: error.message });
            console.log(`❌ Error fixing ${filePath}: ${error.message}`);
        }
    }

    printSummary() {
        console.log('\n📊 Import Fix Summary:');
        console.log(`✅ Fixed files: ${this.fixedFiles.length}`);
        console.log(`❌ Errors: ${this.errors.length}`);
        
        if (this.fixedFiles.length > 0) {
            console.log('\n✅ Successfully fixed:');
            this.fixedFiles.forEach(file => {
                const relativePath = path.relative(projectRoot, file);
                console.log(`   - ${relativePath}`);
            });
        }

        if (this.errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            this.errors.forEach(({ file, error }) => {
                const relativePath = path.relative(projectRoot, file);
                console.log(`   - ${relativePath}: ${error}`);
            });
        }

        console.log('\n🎉 Import path fixing completed!');
        console.log('💡 Please test your application to ensure everything works correctly.');
    }
}

// Run the fixer
const fixer = new ImportPathFixer();
fixer.fixAllImports();