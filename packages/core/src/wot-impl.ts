/********************************************************************************
 * Copyright (c) 2018 - 2019 Contributors to the Eclipse Foundation
 * 
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 * 
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0, or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 * 
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/

import { Observable } from "rxjs/Observable";
import * as WoT from "wot-typescript-definitions";

import * as TD from "@node-wot/td-tools";

import Servient from "./servient";
import ExposedThing from "./exposed-thing";
import ConsumedThing from "./consumed-thing";
import Helpers from "./helpers";
import { ContentSerdes } from "./content-serdes";

export default class WoTImpl implements WoT.WoTFactory {
    private srv: Servient;

    constructor(srv: Servient) {
        this.srv = srv;
    }

    /** @inheritDoc */
    discover(filter?: WoT.ThingFilter): Observable<WoT.ConsumedThing> {
        return new Observable<ConsumedThing>(subscriber => {
            //find things
            //for each found thing
            //subscriber.next(thing);
            subscriber.complete();
        });
    }

    /** @inheritDoc */
    fetch(uri: string): Promise<WoT.ThingDescription> {
        return new Promise<WoT.ThingDescription>((resolve, reject) => {
            let client = this.srv.getClientFor(Helpers.extractScheme(uri));
            console.info(`WoTImpl fetching TD from '${uri}' with ${client}`);
            client.readResource(new TD.Form(uri, ContentSerdes.TD))
                .then((content) => {
                    client.stop();

                    if (content.type !== ContentSerdes.TD &&
                        content.type !== ContentSerdes.JSON_LD ) {
                        console.warn(`WoTImpl received TD with media type '${content.type}' from ${uri}`);
                    }

                    let td = content.body.toString();

                    try {
                        JSON.parse(td);
                    } catch(err) {
                        console.warn(`WoTImpl fetched invalid JSON from '${uri}': ${err.message}`);
                    }

                    resolve(content.body.toString());
                })
                .catch((err) => { reject(err); });
        });
    }

    /** @inheritDoc */
    consume(td: WoT.ThingDescription): WoT.ConsumedThing {
        let thing: TD.Thing;
        
        try {
            thing = TD.parseTD(td, true);
        } catch(err) {
            throw new Error("Cannot consume TD because " + err.message);
        }

        let newThing: ConsumedThing = Helpers.extend(thing, new ConsumedThing(this.srv));

        newThing.extendInteractions();

        console.info(`WoTImpl consuming TD ${newThing.id ? "'" + newThing.id + "'" : "without id"} to instantiate ConsumedThing '${newThing.title}'`);
        return newThing;
    }

    /**
     * Very hacky way to do an interface type check with Typescript
     * https://stackoverflow.com/questions/14425568/interface-type-check-with-typescript
     */
    isWoTThingDescription(arg: any): arg is WoT.ThingDescription {
        return arg.length !== undefined;
    }
    isWoTThingFragment(arg: any): arg is WoT.ThingFragment {
        return arg.title !== undefined;
    }


    // Note: copy from td-parser.ts 
    addDefaultLanguage(thing: any) {
        // add @language : "en" if no @language set
        if(Array.isArray(thing["@context"])) {
          let arrayContext: Array<any> = thing["@context"];
          let languageSet = false;
          for (let arrayEntry of arrayContext) {
            if(arrayEntry instanceof Object) {
              if(arrayEntry["@language"] !== undefined) {
                languageSet = true;
              }
            }
          }
          if(!languageSet) {
            arrayContext.push({
              "@language": TD.DEFAULT_CONTEXT_LANGUAGE
            });
          }
        }
      }

    /**
     * create a new Thing
     *
     * @param title title/identifier of the thing to be created
     */
    produce(model: WoT.ThingModel): WoT.ExposedThing {
        
        let newThing: ExposedThing;

        if (this.isWoTThingDescription(model)) {
            // FIXME should be constrained version of TD.parseTD() that omits instance-specific parts (but keeps "id")
            let template = JSON.parse(model);
            this.addDefaultLanguage(template);
            newThing = Helpers.extend(template, new ExposedThing(this.srv));

        } else if (this.isWoTThingFragment(model)) {
            this.addDefaultLanguage(model);
            let template = Helpers.extend(model, new TD.Thing());
            newThing = Helpers.extend(template, new ExposedThing(this.srv));

        } else {
            throw new Error("Invalid Thing model: " + model);
        }

        /*
        // ensure TD context
        if (typeof newThing["@context"]==="string") {
            if (newThing["@context"]!==TD.DEFAULT_HTTPS_CONTEXT &&
                newThing["@context"]!==TD.DEFAULT_HTTP_CONTEXT) {

                // put TD context last with other context files
                let newContext = [];
                newContext.push(newThing["@context"]);
                newContext.push(TD.DEFAULT_HTTPS_CONTEXT);
                newThing["@context"] = newContext;
            }
        } else if (Array.isArray(newThing["@context"])) {
            if (newThing["@context"].indexOf(TD.DEFAULT_HTTPS_CONTEXT)===-1 &&
                newThing["@context"].indexOf(TD.DEFAULT_HTTP_CONTEXT)===-1) {
                
                // put TD context last with other context files
                newThing["@context"].push(TD.DEFAULT_HTTPS_CONTEXT);
            }
        } else if (typeof newThing["@context"]==="object") {
            // put TD context without prefix
            let newContext = [];
            newContext.push(TD.DEFAULT_HTTPS_CONTEXT);
            newContext.push(newThing["@context"]);
            newThing["@context"] = newContext;
        } else {
            console.error(`WoTImpl found illegal @context: ${newThing["@context"]}`);
        }
        */

        // augment Interaction descriptions with interactable functions
        newThing.extendInteractions();

        console.info(`WoTImpl producing new ExposedThing '${newThing.title}'`);

        if (this.srv.addThing(newThing)) {
            return newThing;
        } else {
            throw new Error("Thing already exists: " + newThing.title);
        }
    }

    /** @inheritDoc */
    register(directory: string, thing: WoT.ExposedThing): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            reject(new Error("WoT.register not implemented"));
        });
    }

    /** @inheritDoc */
    unregister(directory: string, thing: WoT.ExposedThing): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            reject(new Error("WoT.unregister not implemented"));
        });
    }
}

export enum DiscoveryMethod {
    /** does not provide any restriction */
    "any",
    /** for discovering Things defined in the same device */
    "local",
    /** for discovery based on a service provided by a directory or repository of Things  */
    "directory",
    /** for discovering Things in the device's network by using a supported multicast protocol  */
    "multicast"
}

/** Instantiation of the WoT.DataType declaration */
export enum DataType {
    boolean = "boolean",
    number = "number",
    integer = "integer",
    string = "string",
    object = "object",
    array = "array",
    null = "null"
}
