# wgsim Sandbox

WebAssembly-powered [wgsim](https://github.com/lh3/wgsim) API, running on [Cloudflare Workers](https://workers.cloudflare.com/).

## How to use wgsim Sandbox?

You can use the hosted version at [wgsim.sandbox.bio](https://wgsim.sandbox.bio).

## How it works

To perform the simulations, this app runs the C tool [wgsim](https://github.com/lh3/wgsim) compiled to WebAssembly, and runs as a serverless function on [Cloudflare Workers](https://workers.cloudflare.com/). For details about the compilation from C to WebAssembly, see the [biowasm](https://github.com/biowasm/biowasm) project.

See [this article](https://robaboukhalil.medium.com/serverless-genomics-c412f4bed726) for details.
