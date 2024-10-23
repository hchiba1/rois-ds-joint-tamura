function init() {
  // $.get('./js/candidate_names', (res) => {
  //   candidates = res.trim().split('\n')
  // });

  // $('#tags').focus();
  // fetch(`./js/candidate_names`).then(response => {
  
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("system-examples").autocomplete({
  // $('#tags').autocomplete({
    source: (request, response) => {
      response(
        $.grep(candidates, (value) => {
          let regexp = new RegExp('\\b' + escapeRegExp(request.term), 'i');
          return value.match(regexp);
        })
      );
    },
    autoFocus: true,
    delay: 100,
    minLength: 2,
    select: (e, ui) => {
      if (ui.item) {
        let name = ui.item.label;
        name = name.replace(/ \(.+\)$/, '');
        sparqlToRoot(name, (path) => {
          const taxid = path[path.length - 1].id;
          updateTable(taxid);
          addPath(path);
        });
      }
    }
  });
  document.getElementById('button-clear').addEventListener('click', function() {
    blitzboard.setGraph('', true);
  });
});

function updateTable(taxid) {
  document.getElementById('resultsTable').innerHTML = 'Searching ...';
  const sparql = sparqlGenomeMetadata(`taxid:${taxid}`);
  fetch(`https://spang.dbcls.jp/sparql?query=${encodeURIComponent(sparql)}&format=json`).then(res => {
    return res.json();
  }).then(result => {
    renderTable(result);
  });
}

function sparqlToRoot(name, callback) {
  const sparql = `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX taxon: <http://ddbj.nig.ac.jp/ontologies/taxonomy/>
    PREFIX ncbio: <https://dbcls.github.io/ncbigene-rdf/ontology.ttl#>
    SELECT ?tax ?name ?rank ?common_name ?count
    WHERE {
      ?s a taxon:Taxon ;
         rdfs:label "${name}" ;
         rdfs:subClassOf ?tax option(transitive, t_direction 1, t_min 0, t_step("step_no") as ?level) .
      ?tax rdfs:label ?name .
      ?tax taxon:rank/rdfs:label ?rank .
      ?tax ncbio:countRefSeqGenome ?count .
      OPTIONAL {
        ?tax taxon:genbankCommonName ?common_name .
      }
    }
    ORDER BY DESC(?level)
    `;
  fetch(`https://spang.dbcls.jp/sparql?query=${encodeURIComponent(sparql)}&format=json`).then(res => {
    return res.json();
  }).then(json => {
    const results = json.results.bindings;
    let path = [];
    results.forEach((elem) => {
      const taxid = elem.tax.value.replace(/.*\//g, '');
      if (taxid != "1") {
        let node = {
          id: taxid,
          labels: ['Taxon'],
          properties: {
            'name': [elem.name.value],
            'taxon name': [elem.name.value],
            'taxon rank': [elem.rank.value],
            'count': [elem.count.value],
          }
        };
        if (elem.common_name) {
          node.properties['taxon name'][0] += ` (${elem.common_name.value})`;
        }
        path.push(node);
      }
    });
    callback(path);
  });
}

function getThumb(name, callback) {
  const sparqlGetThum = `
        PREFIX wdt: <http://www.wikidata.org/prop/direct/>
        SELECT ?thumb ?name_ja ?rank_ja ?url ?descr_ja
        WHERE {
          ?url wdt:P225 "${name}" .
          ?url rdfs:label ?name_ja .
          ?url wdt:P105/rdfs:label ?rank_ja .
          OPTIONAL {
            ?url wdt:P18 ?thumb .
          }
          FILTER(lang(?name_ja) = 'ja')
          FILTER(lang(?rank_ja) = 'ja')
          OPTIONAL {
            ?url <http://schema.org/description> ?descr_ja .
            FILTER(lang(?descr_ja) = 'ja')
          }
        }`;
  fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlGetThum)}&format=json`).then(res => {
    return res.json();
  }).then(json => {
    callback(json.results.bindings);
  });
}

function addPath(path) {
  if (!blitzboard.hasNode(path[0].id)) {
    blitzboard.addNode(path[0], true);
  }
  for (let i=0; i<path.length-1; i++) {
    if (!blitzboard.hasNode(path[i+1].id)) {
      const node = path[i+1];
      getThumb(node.properties['name'], (results) => {
        for (let elem of results) {
          if (elem.thumb?.value) {
            node.properties.thumbnail = [elem.thumb.value];
          }
          if (elem.url?.value) {
            node.properties.Wikidata = [elem.url.value];
          }
          if (elem.descr_ja?.value) {
            node.properties.description = [elem.descr_ja.value];
          }
          if (elem.rank_ja?.value) {
            node.properties.rank_ja = [elem.rank_ja.value];
          }
          if (elem.name_ja?.value) {
            node.properties.name = [elem.name_ja.value];
          }
        }
        blitzboard.addNode(node, true);
        blitzboard.network.fit();
      });
    }
    if (!blitzboard.hasEdge(path[i].id, path[i+1].id)) {
      blitzboard.addEdge({ from: path[i].id, to: path[i+1].id, labels: ['child taxon'] });
    }
  }
}

function sparqlGenomeMetadata(taxon) {
  return `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX taxid: <http://identifiers.org/taxonomy/>
    PREFIX ncbio: <https://dbcls.github.io/ncbigene-rdf/ontology.ttl#>
    SELECT DISTINCT ?accession ?metadata
    WHERE {
      ?taxid rdfs:subClassOf* ${taxon} .
      ?accession ncbio:taxid ?taxid ;
                 ncbio:metadata ?metadata .
    }
    `;
}

function renderTable(data) {
  const table = document.getElementById('resultsTable');
  table.innerHTML = '';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  [
    '',
    'TaxID',
    'Organism Name',
    'Common Name',
    'RefSeq category',
    'Contig N50',
    'BUSCO lineage',
    'BUSCO complete',
    '# of genes',
    'Genome size',
    'Assembly level',
    '# of chr',
    'Sequencing technology',
    'Release date',
    'Submitter',
    'Sample details',
    'Accession',
  ].forEach(variable => {
    const th = document.createElement('th');
    th.textContent = variable;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  data.results.bindings.forEach(binding => {
    const tr = document.createElement('tr');
    let arr = binding.metadata.value.split('\t');
    arr.shift();
    arr.push(binding.accession.value);
    const td = document.createElement('td');
    td.style.textAlign = 'right';
    tr.appendChild(td);
    for (let i = 0; i < arr.length; i++) {
      const td = document.createElement('td');
      if (arr[i].match(/^http/)) {
        let link = document.createElement('a');
        link.href = arr[i];
        link.textContent = arr[i].replace(/.*\//, '');
        td.appendChild(link);
      } else if (i === 4 || i === 7 || i === 8) {
        td.textContent = Number(arr[i]).toLocaleString();
        td.style.textAlign = 'right';
      } else if (i === 5) {
        td.textContent = arr[i].replace(/_/g, ' ');
      } else if (i === 6) {
        td.textContent = Math.round(Number(arr[i])*10000)/100;
      } else if (arr[i] === 'representative genome') {
        td.textContent = 'representative';
      } else {
        td.textContent = arr[i];
      }
      if (arr[i].match(/^\d\d\d\d-\d\d\-\d\d$/)) {
        td.style.whiteSpace = 'nowrap';
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  $('#resultsTable').tablesorter(
    {
      headers: {
        0: { sorter: false },
      }
    }
  );
}

function addNode (elem, callback) {
  let id = elem.url.value.replace(/.*\//g, '');
  if (blitzboard.hasNode(id)) {
    return;
  }
  let node = {
    id: id,
    labels: ['Taxon'],
    properties: {
      'taxon name': [elem.name.value],
      'taxon rank': [elem.rank.value],
      'tax ID': [elem.url.value],
      'count': [elem.count.value],
    }
  };
  getThumb(elem.name.value, (result) => {
    for (let elem of result) {
      if (elem.thumb?.value) {
        node.properties.thumbnail = [elem.thumb.value];
      }
      if (elem.url?.value) {
        node.properties.Wikidata = [elem.url.value];
      }
      if (elem.descr_ja?.value) {
        node.properties.description = [elem.descr_ja.value];
      }
      if (elem.rank_ja?.value) {
        node.properties.rank_ja = [elem.rank_ja.value];
      }
      if (elem.name_ja?.value) {
        node.properties.name = [elem.name_ja.value];
      }
    }
    if (!node.properties.name) {
      node.properties.name = [elem.name.value];
    }
    blitzboard.addNode(node, false);
    callback(id);
  });
}

function addEdge (child, parent) {
  if (child && parent && !blitzboard.hasEdge(child, parent)) {
    blitzboard.addEdge({
      from: parent,
      to: child,
      labels: ['child taxon'],
    });
  }
}

function addParentNode(taxid) {
  const sparql = sparqlTaxonomyTreeUp(`taxid:${taxid}`);
  const promise = fetch(`https://spang.dbcls.jp/sparql?query=${encodeURIComponent(sparql)}&format=json`).then(res => {
    return res.json();
  }).then(result => {
    for (let elem of result.results.bindings) {
      addNode(elem, (id) => {
        addEdge(taxid, id);
      });
    }
  });
  return promise;
}

function addChildNode(taxid) {
  const sparql = sparqlTaxonomyTreeDown(`taxid:${taxid}`);
  const promise = fetch(`https://spang.dbcls.jp/sparql?query=${encodeURIComponent(sparql)}&format=json`).then(res => {
    return res.json();
  }).then(result => {
    for (let elem of result.results.bindings) {
      addNode(elem, (id) => {
        addEdge(id, taxid);
      });
    }
  });
  return promise;
}

function getComment(name, callback) {
  name = name.replace(/ /g, '_');
  const sparql = `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX dbpedia: <http://dbpedia.org/resource/>
    SELECT ?comment
    WHERE {
      dbpedia:${name} rdfs:comment ?comment .
      FILTER (lang(?comment) = "ja")
    }`;
  fetch(`https://dbpedia.org/sparql?query=${encodeURIComponent(sparql)}&format=json`).then(res => {
    return res.json();
  }).then(result => {
    callback(result);
  });
}

function sparqlTaxonomyTreeUp(child) {
  return `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX taxid: <http://identifiers.org/taxonomy/>
    PREFIX taxon: <http://ddbj.nig.ac.jp/ontologies/taxonomy/>
    PREFIX ncbio: <https://dbcls.github.io/ncbigene-rdf/ontology.ttl#>
    SELECT ?url ?rank ?name ?count
    WHERE {
      ${child} rdfs:subClassOf ?url .
      ?url rdfs:label ?name .
      ?url taxon:rank/rdfs:label ?rank .
      ?url ncbio:countRefSeqGenome ?count .
    }
    `;
}

function sparqlTaxonomyTreeDown(parent) {
  return `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX taxid: <http://identifiers.org/taxonomy/>
    PREFIX taxon: <http://ddbj.nig.ac.jp/ontologies/taxonomy/>
    PREFIX ncbio: <https://dbcls.github.io/ncbigene-rdf/ontology.ttl#>
    SELECT ?url ?rank ?name ?count
    WHERE {
      ?url rdfs:subClassOf ${parent} .
      ?url rdfs:label ?name .
      ?url taxon:rank/rdfs:label ?rank .
      ?url ncbio:countRefSeqGenome ?count .
    }
    `;
}
