/// <reference path="../imports.d.ts" />

import {Environment} from "../../script/code/Environment";
import {Scope} from "../../script/code/Scope";

import {assert} from "chai";

export function testScript(source: string, result: string): Scope {
    let scope = new Scope(null);

    it(`${source} => ${result}`, () => {
        let description = source;

        if (source.indexOf(":") >= 0) {
            description = source.substring(source.indexOf(":") + 1).trim();
            source = source.substring(0, source.indexOf(":")).trim();
        }

        let script = Environment.DEFAULT.parse(source);

        assert.equal(script.describe(), description);
        console.log(script);
        
        assert.equal(script.execute().toString(), result);
    });

    return scope;
}


