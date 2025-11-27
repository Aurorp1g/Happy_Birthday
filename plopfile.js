const fs = require('fs');
const yaml = require('js-yaml');
const fse = require('fs-extra');

// 定义常量
const YAML_PATH = 'config.yaml';
const OUTPUT_DIR = 'dist';
const path = require('path');

function generateActions() {
  const actions = [];
  // 删除输出目录内除了.git之外的所有目录和文件
  if (fs.existsSync(OUTPUT_DIR)) {
    const items = fs.readdirSync(OUTPUT_DIR);
    items.forEach(item => {
      if (item !== '.git') {
        const itemPath = path.join(OUTPUT_DIR, item);
        fse.removeSync(itemPath);
      }
    });
  }
  
  // 复制静态资源
  fse.copySync('templates/music', `${OUTPUT_DIR}/music`, { overwrite: true });
  fse.copySync('templates/img', `${OUTPUT_DIR}/img`, { overwrite: true });
  fse.copySync('templates/woff', `${OUTPUT_DIR}/woff`, { overwrite: true });

  // 读取 YAML 配置
  const yamlContent = fs.readFileSync(YAML_PATH, 'utf8');
  const config = yaml.load(yamlContent);

  // 扫描函数
  function scanDir(dir = '') {
    const fullDir = path.join('templates', dir);
    if (!fs.existsSync(fullDir)) return;

    const files = fs.readdirSync(fullDir);

    files.forEach(file => {
      const fullPath = path.join(fullDir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDir(path.join(dir, file));
      } else if (file.endsWith('.hbs')) {
        const isRoot = dir === '';
        const parentDir = isRoot ? '' : dir.split(path.sep)[0]; // 取第一层目录名

        const extMap = {
          html: 'html',
          js: 'js',
          css: 'css'
        };

        let outputPath;
        if (isRoot) {
          // 根目录 *.hbs -> *.html
          outputPath = path.join(OUTPUT_DIR, file.replace('.hbs', '.html'));
        } else if (extMap[parentDir]) {
          // templates/html/x.hbs -> dist/html/x.html
          const ext = extMap[parentDir];
          outputPath = path.join(
            OUTPUT_DIR,
            dir,
            file.replace('.hbs', `.${ext}`)
          );
        } else {
          return; // 跳过不支持的目录
        }

        actions.push({
          type: 'add',
          path: outputPath,
          templateFile: fullPath,
          data: () => config,
          force: true
        });
      }
    });
  }

  scanDir();
  return actions;
}

function deployActions() {
    const deployDir = OUTPUT_DIR;

    // 后续 git 流程不变
    try {
      execSync('git add .', { cwd: deployDir, stdio: 'inherit' });
      const status = execSync('git status --porcelain', { cwd: deployDir, encoding: 'utf8' });
      if (status.trim()) {
        execSync('git commit -m "Auto deploy"', { cwd: deployDir, stdio: 'inherit' });
        execSync('git push', { cwd: deployDir, stdio: 'inherit' });
        console.log('deploy: git');
      } else {
        console.log('没有检测到文件更改，无需提交');
      }
    } catch (error) {
      console.error('部署失败:', error.message);
      throw error;
    }

    return [];
  }

module.exports = function(plop) {
  plop.setGenerator('g', {
    description: '生成 HTML、JS和CSS 文件',
    prompts: [],
    actions: generateActions
  });
  
  plop.setGenerator('d', {
    description: '部署到GitHub',
    prompts: [],
    actions: deployActions
  });
};