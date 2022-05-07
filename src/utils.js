const url = require("url");
const querystring = require("querystring");
const {TargetDetails} = require("./models/target/targetDetails");
const {TargetList} = require("./models/target/targetList");
const {DiseaseList} = require("./models/disease/diseaseList");
const {LigandList} = require("./models/ligand/ligandList");
const {cred} = require("./db_credentials");
const {performance} = require("perf_hooks");

module.exports.parseResidueData = (results) => {
  const residueData = [];
  let currentResidue = [];
  let lastResidueIndex = -1;
  results.forEach(row => {
    if (lastResidueIndex != row.residue) {
      lastResidueIndex = row.residue;
      currentResidue = [];
      residueData.push(currentResidue);
    }
    currentResidue.push({
      aa: row.aa,
      bits: row.bits
    })
  });
  return residueData;
};

module.exports.applySpecialRoutes = (app, tcrd) => {
  app.get("/render", (req, res) => {
    const parsedUrl = url.parse(req.url);
    const pieces = parsedUrl.query.split('&');
    const paramMap = {};
    pieces.forEach(piece => {
      const chunks = piece.split('=');
      paramMap[chunks[0]] = chunks[1];
    });
    // res.redirect(`https://tripod.nih.gov/servlet/renderServlet?standardize=true&size=${paramMap.size}&structure=${paramMap.structure}`);
    res.redirect(`https://pharos-ligand.ncats.io/indexer/render?structure=${paramMap.structure}&size=${paramMap.size}`);
  });

  app.get("/annotations?*", async (req, res) => {
    const parsedUrl = url.parse(req.url);
    const queryMap = querystring.parse(parsedUrl.query);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const targetDetails = new TargetDetails({}, {uniprot: queryMap.uniprot}, tcrd);
    const results = await targetDetails.getSequenceAnnotations();
    res.end(JSON.stringify(results));
  });

  app.get("/variants?*", async (req, res) => {
    const parsedUrl = url.parse(req.url);
    const queryMap = querystring.parse(parsedUrl.query);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const targetDetails = new TargetDetails({}, {uniprot: queryMap.uniprot}, tcrd);
    const results = await targetDetails.getSequenceVariants();
    res.end(JSON.stringify(parseResidueData(results)));
  });

  app.get("/sitemap.xml", async (req, res) => {
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const targetList = new TargetList(tcrd, {fields: ["Preferred Symbol"]});
    const diseaseList = new DiseaseList(tcrd, {fields: ["Associated Disease"]});
    const ligandList = new LigandList(tcrd, {
      fields: ["Ligand Name"],
      filter: {facets: [{facet: "Type", values: ["Drug"]}]}
    });

    const targetQuery = targetList.getListQuery("list");
    const diseaseQuery = diseaseList.getListQuery("list").andWhere("name", "not like", '%(%');
    const ligandQuery = ligandList.getListQuery("list").andWhere("name", "not like", '%(%');

    // console.log(ligandQuery.toString());

    const targetResults = await targetQuery;
    const diseaseResults = await diseaseQuery;
    const ligandResults = await ligandQuery;

    const results = [
      ...targetResults.map(r => "targets/" + r.preferredSymbol),
      ...diseaseResults.map(r => "diseases/" + r.Name),
      ...ligandResults.map(r => "ligands/" + r.name)
    ];
    const mappedElements = results.map(r => `<url><loc>https://pharos.nih.gov/${r}</loc><lastmod>${cred.LASTMOD}</lastmod></url>`).join('\n');
    res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${mappedElements}
</urlset>`);
  });
};

module.exports.monitorPerformance = () => {
  const args = process.argv.slice(2);

  if (args && args.length > 0 && args[0] === 'perf') {
    console.log('time, heapTotal, heapUsed, external');
    setInterval(() => {
      const mem = process.memoryUsage();
      console.log(`${performance.now()}, ${mem.heapTotal / (1024 * 1024)}, ${mem.heapUsed / (1024 * 1024)}, ${mem.external / (1024 * 1024)}`);
    }, 5000);
  }
}