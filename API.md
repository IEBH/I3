## Classes

<dl>
<dt><a href="#I3">I3</a></dt>
<dd><p>I3 main instance</p>
</dd>
<dt><a href="#I3App">I3App</a></dt>
<dd><p>An I3 App</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#AppResponse">AppResponse</a> : <code>Object</code></dt>
<dd><p>AppResponse object
Returned by I3App.run()</p>
</dd>
</dl>

<a name="I3"></a>

## I3
I3 main instance

**Kind**: global class  
**Emits**: <code>event:log Emitted on any log event of this or any child class</code>  

* [I3](#I3)
    * [.classes](#I3+classes) : <code>Object</code>
    * [.settings](#I3+settings) : <code>Object</code>
    * [.log](#I3+log)
    * [.createApp](#I3+createApp) ⇒ [<code>I3App</code>](#I3App)

<a name="I3+classes"></a>

### i3.classes : <code>Object</code>
Available I3 classes

**Kind**: instance property of [<code>I3</code>](#I3)  
<a name="I3+settings"></a>

### i3.settings : <code>Object</code>
Settings object

**Kind**: instance property of [<code>I3</code>](#I3)  
<a name="I3+log"></a>

### i3.log
Debugger and general output function
With apps this is prefixed with the app name
Also includes the `log.colors` convience object which provides a Chalk instance

**Kind**: instance property of [<code>I3</code>](#I3)  
<a name="I3+createApp"></a>

### i3.createApp ⇒ [<code>I3App</code>](#I3App)
Build an app from the path to a i3.json file, this can be a URL or local path

**Kind**: instance property of [<code>I3</code>](#I3)  
**Returns**: [<code>I3App</code>](#I3App) - An I3 app instance  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | Path to the i3.json file (can also be a URL) |

<a name="I3App"></a>

## I3App
An I3 App

**Kind**: global class  

* [I3App](#I3App)
    * [new I3App(i3, path)](#new_I3App_new)
    * [.i3](#I3App+i3) : [<code>I3</code>](#I3)
    * [.id](#I3App+id) : <code>string</code>
    * [.path](#I3App+path) : <code>string</code>
    * [.manifest](#I3App+manifest) : <code>Object</code>
    * [.name](#I3App+name) : <code>string</code>
    * [.log](#I3App+log)
    * [.init](#I3App+init) ⇒ [<code>Promise.&lt;I3App&gt;</code>](#I3App)
    * [.validateManifest](#I3App+validateManifest) ⇒ <code>Promise</code>
    * [.build](#I3App+build) ⇒ <code>Promise</code>
    * [.resolveConfig](#I3App+resolveConfig) ⇒ <code>Promise</code>
    * [.run](#I3App+run) ⇒ [<code>Promise.&lt;AppResponse&gt;</code>](#AppResponse)

<a name="new_I3App_new"></a>

### new I3App(i3, path)

| Param | Type | Description |
| --- | --- | --- |
| i3 | [<code>I3</code>](#I3) | The I3 parent instance |
| path | <code>string</code> | The base path of the app (usually a file path on disk) |

<a name="I3App+i3"></a>

### i3App.i3 : [<code>I3</code>](#I3)
Parent I3 instance
Defined on construction

**Kind**: instance property of [<code>I3App</code>](#I3App)  
<a name="I3App+id"></a>

### i3App.id : <code>string</code>
Unique ID for this app instance

**Kind**: instance property of [<code>I3App</code>](#I3App)  
<a name="I3App+path"></a>

### i3App.path : <code>string</code>
During the build phrase this is the originally provided path to the source app, after build this should be the path on disk

**Kind**: instance property of [<code>I3App</code>](#I3App)  
<a name="I3App+manifest"></a>

### i3App.manifest : <code>Object</code>
The loaded app manifest

**Kind**: instance property of [<code>I3App</code>](#I3App)  
<a name="I3App+name"></a>

### i3App.name : <code>string</code>
Friendly name for this app

**Kind**: instance property of [<code>I3App</code>](#I3App)  
<a name="I3App+log"></a>

### i3App.log
Debug output hook
This really just wraps the main I3 debug function with a prefix
This object also contains {warn, colors} convenience functions (see controller)

**Kind**: instance property of [<code>I3App</code>](#I3App)  

| Param | Type | Description |
| --- | --- | --- |
| [msg...] | <code>\*</code> | Output message components |

<a name="I3App+init"></a>

### i3App.init ⇒ [<code>Promise.&lt;I3App&gt;</code>](#I3App)
Initialize the app environment by fetching the manifest and parsing it

**Kind**: instance property of [<code>I3App</code>](#I3App)  
**Returns**: [<code>Promise.&lt;I3App&gt;</code>](#I3App) - A promise which will return the full app object when complete  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>object</code> |  | Options to use when building |
| [options.validate] | <code>boolean</code> | <code>true</code> | Validate the manifest, only disable this if you absolutely trust the app source |
| [options.build] | <code>boolean</code> | <code>true</code> | Automatically build the app, if falsy call I3App.build() manually |

<a name="I3App+validateManifest"></a>

### i3App.validateManifest ⇒ <code>Promise</code>
Validate a manifest schema

**Kind**: instance property of [<code>I3App</code>](#I3App)  
**Returns**: <code>Promise</code> - A promise which will return if the manifest validates or throws with a string of errors if not  
<a name="I3App+build"></a>

### i3App.build ⇒ <code>Promise</code>
Build the app (using whatever means is specified)

**Kind**: instance property of [<code>I3App</code>](#I3App)  
**Returns**: <code>Promise</code> - A promise which will return when built or throw if an error occurs during the build process  
<a name="I3App+resolveConfig"></a>

### i3App.resolveConfig ⇒ <code>Promise</code>
Validate the manifest config, apply defaults and return the final config we would use when running the app
Automatically conduceted by I3App.run()

**Kind**: instance property of [<code>I3App</code>](#I3App)  
**Returns**: <code>Promise</code> - A promise which will either resolve with the computed full config object or throw with a validation message  

| Param | Type | Description |
| --- | --- | --- |
| config | <code>Object</code> | The input config |

<a name="I3App+run"></a>

### i3App.run ⇒ [<code>Promise.&lt;AppResponse&gt;</code>](#AppResponse)
Execute this app instance within a Docker container using predefined config

**Kind**: instance property of [<code>I3App</code>](#I3App)  
**Returns**: [<code>Promise.&lt;AppResponse&gt;</code>](#AppResponse) - A Promise which resolves to an AppResponse object  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>Object</code> | Setttings to pass when running |
| [options.resolveConfig] | <code>Object</code> | Run config via I3App.resolveConfig() |
| [options.config] | <code>Object</code> | Settings config object, defaults will be auto-computed and inserted |
| [inputs] | <code>array.&lt;(string\|null)&gt;</code> | Array of input files, either the path to the file on disk or `null` if not specified (i.e. file is optional) |
| [outputs] | <code>array.&lt;(string\|null)&gt;</code> | Array of output file destinations, either the path to the file on disk or `null` if not specified (i.e. file is optional and not required) |

<a name="AppResponse"></a>

## AppResponse : <code>Object</code>
AppResponse object
Returned by I3App.run()

**Kind**: global typedef  
**See**: I3App.run()  

| Param | Type | Description |
| --- | --- | --- |
| inputs | <code>array.&lt;(string\|null)&gt;</code> | Array of input files, either the path to the file on disk or `null` if not specified (i.e. file is optional) |
| outputs | <code>array.&lt;(string\|null)&gt;</code> | Array of generated output files, either the path to the file on disk or `null` if the output was not requested |

**Properties**

| Name | Type | Description |
| --- | --- | --- |
| app | <code>Object</code> | The app manifest used, since I3App.manifest is frozen this cannot be mutated |
| config | <code>Object</code> | The input config |

