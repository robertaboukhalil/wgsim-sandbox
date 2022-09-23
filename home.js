const homepage = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <meta name="description" content="Sequencing data simulator wgsim">
    <title>wgsim</title>
    <link rel="icon" href="https://sandbox.bio/assets/img/favicon.ico">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css" integrity="sha384-TX8t27EcRE3e/ihU7zmQxVncDAy5uIKz4rEkgIXeMed4M0jlfIDPvg6uqKI2xXr2" crossorigin="anonymous">
  </head>
  <body>
    <nav class="navbar navbar-expand-md navbar-dark fixed-top bg-dark">
      <div class="container">
        <a class="navbar-brand" href="/">wgsim</a>
      </div>
    </nav>

    <main role="main">
      <div class="jumbotron mt-5 mt-md-2 pb-1">
        <div class="container mt-4 mb-4">
          <p class="lead">
            API that simulates sequencing reads using <a href="https://github.com/lh3/wgsim">wgsim</a>, which was compiled to WebAssembly and runs as a <a href="https://workers.cloudflare.com/">Cloudflare Worker</a>.
          </p>
          <p class="lead">
            For details, check out <a href="https://robaboukhalil.medium.com/serverless-genomics-c412f4bed726">this blog post</a> or see the source code on <a href="https://github.com/robertaboukhalil/wgsim-sandbox">GitHub</a>.
          </p>
        </div>
      </div>

      <div class="container">
        <div class="row mt-4">
          <div class="col-md-6">
            <div class="row">
                <div class="col-6">
                    <button id="btnRefresh" class="btn btn-primary mb-3" onclick="javascript:getSequences()">Refresh</button>
                </div>
                <div class="col-6">
                  <select id="chromosomes" class="custom-select" onchange="getSequences()">
                    <option disabled>Chromosomes</option>
                  </select>
                </div>
            </div>
            <pre class="mb-3" id="wgsim" style="border:1px solid #eee; padding:10px"></pre>
          </div>
          <div class="col-md-6">
            <div class="row">
                <div class="col-md-12">
                    <h3>APIs</h3>
                    <ul style="line-height: 1.5em;">
                        <li><strong>Run wgsim</strong>: <code><a href="https://wgsim.sandbox.bio/api/v1/sequences?n=10&chrom=chr1&length=70&error=0.02" target="_blank">wgsim.sandbox.bio/api/v1/sequences</a></code></li>
                        <li><strong>Reference genomes</strong>: <code><a href="https://wgsim.sandbox.bio/api/v1/references" target="_blank">wgsim.sandbox.bio/api/v1/references</a></code></li>
                    </ul>
                    <br />

                    <h3>URL Parameters</h3>
                    <ul style="line-height: 1.5em;">
                        <li><strong>chrom</strong>: Chromosome - default: <code>chr1</code></li>
                        <li><strong>start</strong>: Start position - default: <code>random</code></li>
                        <li><strong>stop</strong>: Stop position - default: <code>start + 1e3</code></li>
                        <li><strong>length</strong>: Sequence length - default: <code>70</code></li>
                        <li><strong>n</strong>: Number of sequences per chunk - default: <code>10</code></li>
                        <li class="mb-4"><strong>ref</strong>: Ref genome - default: <code>hg38</code> <small>(only hg38 supported)</small></li>
                        <li><strong>error</strong>: Base error rate - default: <code>0.02</code></li>
                        <li><strong>indel_frac</strong>: Fraction of indels - default: <code>0.15</code></li>
                        <li><strong>indel_extend</strong>: Probability an indel is extended - default: <code>0.3</code></li>
                        <li class="mb-4"><strong>mutation_rate</strong>: Mutation rate - default: <code>0.001</code></li>
                        <li><strong>seed</strong>: Random seed - default: <code>null</code></li>
                    </ul>
                </div>
            </div>
        </div>
      </div>
      <br /><br />
    </main>
  </body>

  <script>
    const elDropdown = document.getElementById("chromosomes");

    async function getChromosomes() {
        let ref = (await fetch("https://wgsim.sandbox.bio/api/v1/references").then(d => d.json())).pop();
        ref.chromosomes.map((d, i) => {
          if(i === 0)
            elDropdown.value = d.name;
          elDropdown.options[elDropdown.options.length] = new Option(d.name, d.name);
        });
    }

    async function getSequences() {
        
        // Make the API query
        document.getElementById("btnRefresh").disabled = true;
        const url = "https://wgsim.sandbox.bio/api/v1/sequences?n=5&length=50&format=text&chrom=" + (elDropdown.value || "chr1");
        const result = await fetch(url).then(d => d.text());
        document.getElementById("btnRefresh").disabled = false;

        // Update the output
        document.getElementById("wgsim").innerText = result;
    }

    getChromosomes().then(getSequences);
  </script>
</html>
`;

export default homepage;
