import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { listRecipes, validateRecipePath, testRecipePath } from '../dist/recipe-commands.js';

test('recipe commands list builtins and reject malicious recipe', async()=>{const ids=await listRecipes(resolve('.'));assert.ok(ids.length>=10);const bad=await validateRecipePath(resolve('fixtures/malicious-recipe/recipe.yml'),{mode:'safe'});assert.equal(bad.valid,false);assert.match(bad.errors.join(' '),/run|unknown/i);});

test('recipe test validates a builtin without shell or network', async()=>{const result=await testRecipePath(resolve('recipes/wordpress/plugin-review.yml'),{mode:'safe'});assert.equal(result.valid,true);assert.equal(result.shellExecutions,0);assert.equal(result.networkRequests,0);});
