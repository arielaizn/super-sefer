// משימות רינדור — רצות בתהליך Electron (חלון נסתר). נקראות מה-GUI ישירות, ומה-CLI דרך --job
const fs = require('fs');
const path = require('path');
const { Project } = require('./project');
const build = require('./build');
const pdf = require('./pdf');
const layout = require('./layout');
const postproof = require('./postproof');

const safeName = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'ספר';

async function runJob(job, onProgress = () => {}) {
  const project = job.dir ? Project.open(job.dir) : null;
  switch (job.type) {
    case 'interior': return build.buildInterior(project, { outFile: job.out, onProgress, smart: job.smart !== false });
    case 'cover': return build.buildCover(project, { outFile: job.out, mode: job.mode, pages: job.pages, design: job.design, guides: !!job.guides });
    case 'postproof': {
      const st = project.data.stages.layout;
      if (!st) throw new Error('עוד לא נבנה PDF — הריצו קודם עימוד');
      const file = path.join(project.dir, st.file);
      const r = await postproof.run(project, file, { starts: st.starts, frontCount: st.frontCount, geometry: layout.geometry(project) });
      project.data.stages.postproof = { at: new Date().toISOString(), passed: r.passed, blockers: r.blockers.length, warnings: r.warnings.length };
      project.save();
      return r;
    }
    case 'raster': return pdf.rasterize(job.file, { pages: job.pages, scale: job.scale || 1, outDir: job.outDir });
    case 'export': {
      const out = job.out || path.join(require('os').homedir(), 'Downloads', safeName(project.data.title));
      fs.mkdirSync(out, { recursive: true });
      const nm = safeName(project.data.title);
      const interior = await build.buildInterior(project, { outFile: path.join(out, `${nm} — פנים הספר.pdf`), onProgress, smart: job.smart !== false });
      onProgress({ msg: 'בונה כריכה…' });
      const cov = await build.buildCover(project, { outFile: path.join(out, `${nm} — כריכה.pdf`), pages: interior.pages, mode: job.coverMode || project.data.cover.pagesMode || 'spread' });
      let covPages = null;
      if (job.both) covPages = await build.buildCover(project, { outFile: path.join(out, `${nm} — כריכה (חזית וגב בעמודים).pdf`), pages: interior.pages, mode: 'pages' });
      project.data.stages.export = { at: new Date().toISOString(), dir: out, pages: interior.pages };
      project.log(`יוצא ל-${out}`, 'export'); project.save();
      return { dir: out, interior, cover: cov, coverPages: covPages };
    }
    default: throw new Error('משימה לא מוכרת: ' + job.type);
  }
}

module.exports = { runJob, safeName };
