#!/usr/bin/env node
import { runCli } from "./app.js";
runCli().then((code)=>{process.exitCode=code;}).catch((error)=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
