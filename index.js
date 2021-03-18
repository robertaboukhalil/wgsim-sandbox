import homepage from "./home.js";
import emscripten from "./wgsim/wgsim.js";
import { CHROMS_HG38 } from "./data.js";

// TODO: fix issue with all N's
// TODO: check that stop doesn't exceed chrom length when don't specify start/stop pos
// TODO: UI

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const FASTA_URL = "http://s3.amazonaws.com/1000genomes/technical/reference/GRCh38_reference_genome/GRCh38_full_analysis_set_plus_decoy_hla.fa";

// CORS
const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "HEAD, GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

// Genome
const GENOME_HG38 = {
	genome: "hg38",
	genomeDescription: "hg38, GRCh38 Genome Reference Consortium Human Reference 38",
	genomeSource: "https://registry.opendata.aws/1000-genomes/"
}

// -----------------------------------------------------------------------------
// Handle requests
// -----------------------------------------------------------------------------

addEventListener("fetch", event => {
	if(event.request.method === "OPTIONS")
		event.respondWith(handleOptions(event));
	else
		event.respondWith(handleRequest(event));
});

async function handleOptions(event) {
	const headers = event.request.headers;
	if(headers.get("Origin") !== null && headers.get("Access-Control-Request-Method") !== null && headers.get("Access-Control-Request-Headers") !== null)
		return new Response(null, { headers: {
			"Access-Control-Max-Age": 86400,
			...CORS_HEADERS
		}});
	else
		return new Response(null, { headers: { Allow: "GET, OPTIONS" } });
}

// -----------------------------------------------------------------------------
// Handle GET requests
// -----------------------------------------------------------------------------
async function handleRequest(event)
{
	const url = new URL(event.request.url);
	const path = url.pathname;

	// Home page
	if(path == "/")
		return new Response(homepage, { status: 200, headers: { "Content-Type": "text/html" } });

	// API endpoint to get ref genome info
	else if(path.startsWith("/api/v1/references"))
		return new Response(
			JSON.stringify( [{...GENOME_HG38, ...{chromosomes: CHROMS_HG38}}] ),
			{ status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
		);

	// API endpoint to run wgsim
	else if(path.startsWith("/api/v1/sequences"))
	{
		// Get user input
		let chrom = url.searchParams.get("chrom") || "chr20";
		let start = +url.searchParams.get("start") || 10e6;
		let stop = +url.searchParams.get("stop") || start + 1e3;
		let chromInfo = CHROMS_HG38.filter(d => d.name == chrom).pop();
		let seed = url.searchParams.get("seed") || "-1";
		let random = url.searchParams.get("random") || false;

		// Generate random position
		if(random) {
			if(seed == "-1")
				seed = null;
			const rng = new RNG(seed);  // seed == null ==> generate rnd number and store in rng.state
			seed = rng.state;
			chromInfo = CHROMS_HG38[(rng.nextInt() % 24)];
			chrom = chromInfo.name;
			start = rng.nextInt() % Math.floor(chromInfo.size/2);  // avoid random starts too far to the end
			stop = start + 1e3 - 1;
			if(stop > chromInfo.size)
				stop = chromInfo.size;
		}

		// Wgsim params
		const input_e = url.searchParams.get("error") || "0.02";
		const input_s = url.searchParams.get("stdev") || "50";
		const input_N = url.searchParams.get("n") || "10";
		const input_1 = url.searchParams.get("length") || "70";
		const input_r = url.searchParams.get("mutation_rate") || "0.001";
		const input_R = url.searchParams.get("indel_frac") || "0.15";
		const input_X = url.searchParams.get("indel_extend") || "0.3";
		const input_A = url.searchParams.get("ambiguous_max") || "0.05";
		const input_haplotype = url.searchParams.get("haplotype") ? true : false;

		// Validate user input
		let error = "";
		if(chromInfo == null)
			error = `Chromosome '${chrom}' does not exist in hg38`;
		else if(![start, stop].every(d => Number.isInteger(+d)) || start < 0 || stop < 0)
			error = "Coordinates should be positive integers.";
		else if(start >= stop)
			error = "Start coordinate cannot be larger than stop coordinate";
		else if(start >= chromInfo.size || stop > chromInfo.size)
			error = `${chrom} has a size of ${chromInfo.size} but asking for region outside that range`;
		else if(![input_s, input_N, input_1].every(d => Number.isInteger(+d)))
			error = "Parameters n, length and stdev must be integers.";
		else if(![input_e, input_r, input_R, input_X, input_A].every(d => !Number.isNaN(Number.parseFloat(d))))
			error = "Mutation parameters must be numbers.";
		if(error != "")
			return new Response(
				JSON.stringify({ error: { code: 400, message: error }}),
				{ status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
			);

		// Prepare wgsim parameters
		let params = [
			"-e", input_e,
			"-s", input_s,
			"-N", input_N,
			"-1", input_1,
			"-2", "1",  // single-ended only
			"-r", input_r,
			"-R", input_R,
			"-X", input_X,
			"-A", input_A,
			"-S", seed
		];
		if(input_haplotype)
			params.push("-h");

		// Fetch FASTA data from AWS
		const fetchByteStart = getByteOffset(start, chromInfo);
		const fetchByteStop = getByteOffset(stop, chromInfo);
		let response = await fetch(FASTA_URL, { headers: { Range: `bytes=${fetchByteStart}-${fetchByteStop}` } });

		// Stream the response while running wgsim on each chunk of data we get back from AWS
		let { readable, writable } = new TransformStream();
		let bodyPromise = processFASTA(response.body, writable, `${chrom}:${start}-${stop}`, params);
		event.waitUntil(bodyPromise);
		return new Response(readable, { status: 200, headers: { "Content-Type": "text/plain" } });
	}

	// Unknown path
	else
		return new Response(`404\n`, { status: 404, headers: { "Content-Type": "text/plain" } });
}

// -----------------------------------------------------------------------------
// Stream FASTA
// -----------------------------------------------------------------------------
async function processFASTA(readable, writable, regionName, params)
{
	let reader = readable.getReader();
	let writer = writable.getWriter();
	let encoder = new TextEncoder("utf-8");
	let decoder = new TextDecoder("utf-8");

    for (;;) {
		// Process a chunk of data (~4096 bytes)
		let { value, done } = await reader.read();
		if (done)
			break;

		// Remove break lines from data received
		let valueStr = decoder.decode(value).replace(/(\r\n|\n|\r)/gm, "");

		// All N's make wgsim unhappy
		const nbNs = valueStr.split("").filter(d => d == "N").length;
		if(nbNs == valueStr.length)
			continue;

		let emscripten_module = new Promise((resolve, reject) => {
			emscripten({
				instantiateWasm(info, receive) {
					let instance = new WebAssembly.Instance(wasm, info);
					receive(instance);
					return instance.exports;
				},
			}).then(module => { resolve({ module: module }) });
		});
		let m = await emscripten_module;
		let Module = await m.module;
		let FS = await m.module.FS;

		FS.writeFile("/tmp.fa", `>${regionName}\n${valueStr}`);
		Module.callMain([...params, ...`/tmp.fa /r1.fq /r2.fq`.split(" ")]);
		const outWgsim = FS.readFile("/r1.fq", { encoding: "utf8" });
		await writer.write(encoder.encode(outWgsim));
	}
	await writer.close();
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

// Calculate byte range needed from a FASTA file given FAI information
// https://github.com/samtools/htslib/blob/develop/faidx.c#L705
function getByteOffset(pos, chromInfo) {
	const offset = chromInfo.offset,
		  lengthBp = chromInfo.lengthBp,
		  lengthBytes = chromInfo.lengthBytes;
	return offset                   // skip to first byte of chromosome of interest
		+ Math.floor(pos/lengthBp)  // how many lines before we get to start position?
		* lengthBytes               // skip to byte that represents the line of interest
		+ pos % lengthBp            // once at that line, just move right by a few bytes
		-1;
}

// Random number generator with seed - https://stackoverflow.com/a/424445
function RNG(seed) {
  // LCG using GCC's constants
  this.m = 0x80000000; // 2**31;
  this.a = 1103515245;
  this.c = 12345;

  this.state = seed ? seed : Math.floor(Math.random() * (this.m - 1));
}
RNG.prototype.nextInt = function() {
  this.state = (this.a * this.state + this.c) % this.m;
  return this.state;
}
