
'use strict';

//todo
//save results as json array of objects
//eventually zipped
//remove layer from the map

// hex conversion code adapted from
// https://stackoverflow.com/questions/38987784/how-to-convert-a-hexadecimal-string-to-uint8array-and-back-in-javascript
const isHex = (maybeHex) => {
	return /^[xX]\'(([a-f0-9A-F]){2})+\'$/.test(maybeHex);
}

const fromHexString = (hexString) => {
	hexString = hexString.slice(2, -1);
	return Uint8Array
		.from(hexString.match(/(([a-f0-9A-F]){2})/g)
		.map((byte) => parseInt(byte, 16)));
}

const toHexString = (bytes) => {
	return "x'" + bytes
		.reduce((str, byte) => {
			return str + byte
				.toString(16)
				.padStart(2, '0');
		}, '') + "'";
}

class SQLQuery {
	
	fieldTypes = {
		NULL: ['^$', '', x => null, true, 'null'],
		INTEGER: ['^([+-]?[1-9]\\d*([Ee][+-]?[1-9]\\d*)?|0)$', '', parseInt, false, '123'],
		REAL: ['^[+-]?(([1-9]\\d*(\\.\\d*)?([Ee][+-]?[1-9]\\d*)?|0)|Infinity)$', '', parseFloat, false, '123.45'],
		TEXT: ['.*', '', x => x, false, 'abc'],
		BLOB: ["^[xX]\\'(([a-f0-9A-F]){2})+\\'$", '', x => isHex(x) ? fromHexString(x).buffer : undefined, false, "x'4C696665'"],
		DATETIME: ['^[1-9]\\d{3}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$', '', x => parseDate(x), false, '2009-09-28T09:15:15'],
	};
	
	snippets = {
		allTables: `
			SELECT name
			FROM sqlite_schema
			WHERE type ='table' AND 
				name NOT LIKE 'sqlite_%';`,
		tableFields: `
			SELECT *
			FROM pragma_table_info('table_name')`,
		allDbs: `
			select * 
			from PRAGMA_database_list`,
		compileOptions: `
			select * 
			from PRAGMA_compile_options`,
		attachMountedDb: `
			ATTACH DATABASE '/proj/proj.db' AS proj`,
		generateSeries: `
			SELECT value
			FROM generate_series --(5,100,5)
			where start=5 and stop=50 and step=5`,
		pentagonPoints: `
			with icons as $(pinpng)
			SELECT
				flatstyle, 
				makepoint(
					100 + 40 * sin((value % 5) * radians(360) / 5),
					100 + 40 * cos((value % 5) * radians(360) / 5),
					3857
				) as feature
			FROM generate_series as ctr
			inner join icons on 1
			where ctr.start=0 and ctr.stop=5`,
		pinpng: `
			select
				json_object(
					--'text-value', '',
					'icon-color', '#8959A8',
					'icon-cross-origin', 'anonymous',
					'icon-src', 'data:'||pinpng
					
					--'circle-stroke-color', 'blue',
					--'circle-stroke-width', 1,
					--'circle-radius', 5
				) as flatstyle
			from (select 1)
			inner join (
				select 
					'image/png;base64,
					iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlz
					AAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAJISURB
					VDiNjZHNS5RRGMXPc1/nvmOlZjPkQJqRGlIL01IcIjDMhYHJZEiBhIugPyBbBm6CCFrUTg2yDwhE
					yKBds1CyMvyoxMFCTFvIYCk2hTrz3vfep0UOTDOjdHbPPb97OPc+hDQ1cHfO8u/iTgJ3MnAcAAj4
					yMDD2byCflC7TuUpdTj2fWCPsjaHADrJbHpYiFEAsJhPM3AN4PdeJULTgSvryTsiNSCuTZ927FKV
					sKpoc9d9jtsBjtsB3si95ziySjvewxuQPVkblC4OVgshJgRTnWuZfGFoiIEf9JfxM1GrYLPOoDEI
					1CwUX/j0TwPW3hat5MR8aWiSE3afduWjxZJQxUJJqNx15GPjePq+Hmwb10pOmbjdkvEE49jFxrHn
					D8yGfcaxyzju6QURg4hZ2b3Gscu3vDmtZElmgLKjRsmipcrGNaNkTKvc+qSnlQxqJX8uVTauGUcG
					jCOjGX+wf3ysCcQvDTyHLLjtDL7DwBNBRMzcwUAXwzMooL4R49xybTCcsUb/26lxEH9ZCZ7o8I19
					aCXmywDARM9W66tf+N9NPgXoyEqwpg7Z5BueqS0cibh7RyLn073C4Uhz4ciM3jc8Hcy6xqTyw3N3
					Ab5ksXV0raksBgD+0c95TlxECDQQO1vRlcqL9IBfm7tvGsfeUK7nVvIsHvPe1o6tpVXQnc5nNAAA
					7/NoAwmEmfkMWZYLY14biOZEa9Gr/woAAHtw9QGAU1vjm8RF39VsXM52AQlD13NcGQFgueze2I7b
					Wf2JNvQn2nZC/gBcKQLqzHjHRAAAAABJRU5ErkJggg==
					' as pinpng
				) on 1=1
			`,
		xyncolor: `
			with t1(x,y,n,color) as
			(VALUES
				(100,100,3,'red'),
				(200,100,4,'orange'),
				(300,100,5,'green'),
				(400,100,6,'blue'),
				(500,100,7,'purple'),
				(100,200,8,'red'),
				(200,200,10,'orange'),
				(300,200,12,'green'),
				(400,200,16,'blue'),
				(500,200,20,'purple')
			)
			select * from t1
			`,
		polygonGeometries: `
			WITH t1 AS $(xyncolor)
			SELECT
				json_object(
					'type', 'Polygon',
					'coordinates',
					json_array(json(
						geopoly_json(
							geopoly_regular(x,y,40,n)
						)
					))
				) as feature,
				json_object(
					'fill-color', color,
					'fill-opacity', 0.05,
					'stroke-color', color,
					'stroke-width', 2,
					'text-value', cast (n as text)
				) as flatstyle,
				cast (n as text) as name
			FROM t1
			`,
		polygonFeatures: `
			WITH t1 AS $(polygonGeometries)
			SELECT
				json_object(
					'type', 'Feature',
					'geometry', json(Feature),
					'properties',
					json_object(
						'name', name,
						'flatstyle', json(flatstyle)
					)
				) as feature
			FROM t1
			`,
		featuresCollection: `
			WITH t1 AS $(polygonFeatures)
			SELECT
				json_object(
					'type', 'FeatureCollection',
					'crs',
					json('{ "type": "name", "properties": { "name": "EPSG:900913" } }'),
					'features',
					json_group_array(
						json(feature)
					)
				) as feature
			FROM t1
			`,
		builtPolygons: `
			WITH t1 AS $(xyncolor)
			SELECT
				json_object(
					'fill-color', color,
					'fill-opacity', 0.05,
					'stroke-color', color,
					'stroke-width', 2,
					'text-value', cast (n as text)
				) as flatstyle,
				makepolygon(makeline(point)) as feature
			from (
				select
					makepoint(
						x + 40 * sin((value % n) * 2 * pi() / n),
						y + 40 * cos((value % n) * 2 * pi() / n),
						3857
					) as point,
					n,
					color
				FROM t1
				inner join generate_series
					on generate_series.start=0 and generate_series.stop=t1.n and generate_series.step=1
			)
			group by n, color
			`
	};
	
	constructor(selector, db, snippets, map) {
		this.sqlQuery = document.querySelector(selector);
		this.db = db;
		if (snippets) {
			this.snippets = snippets;
		}
		if (map) {
			this.map = map;
		}
		this.tabCounter = 0;
		this.buildForm();
	}
	
	paramType(_this) {
		let tr = _this.closest('tr');
		let val = tr.querySelector('.value');
		let [pattern, dflt, fmt, disabled, placeholder] = this.fieldTypes[_this.value];
		val.value = dflt;
		val.disabled = disabled;
		val.pattern = `/${pattern}/`;
		val.placeholder = placeholder;
	}
	
	queryTab(_this) {
		let tab = _this.closest('div[data-tab-info]');
		return tab;
	}
	
	addParam(button, name='') {
		function typeOptions(fieldTypes) {
			return Object.keys(fieldTypes)
				.map(type => `<option value="${type}" ${type == 'NULL' ? 'selected="selected"' : ''}>${type}</option>`)
				.reduce((a, b) => (a + '\n' + b), '')
				;
		}
		let row = `
			<tr>
				<td style="width: 30%">
					<input class="variable" type="text" value="${name}" placeholder="name" style="width: 100%" />
				</td>
				<td style="width: 30%">
					<select class="type" style="width: 100%">
						${typeOptions(this.fieldTypes)}
					</select>
				</td>
				<td style="width: 30%">
					<input class="value" pattern="/^$/" disabled="disabled" value="" placeholder="null" style="width: 100%" />
				</td>
				<td style="width: 10%"><button class="del-param">del</button></td>
			</tr>
			`;
		let params = this.queryTab(button)
			.querySelector('.sqlParams');
		params.insertAdjacentHTML('beforeend', row);
		let newVar = params.querySelector('tr:last-child');
		newVar.querySelector('input.variable').addEventListener('blur', e => {
			this.buildParams(e.currentTarget, false);
			e.stopPropagation();
		});
		newVar.querySelector('select.type').addEventListener('change', e => {this.paramType(e.currentTarget);});
		newVar.querySelector('input.value').addEventListener('blur', e => {
			this.buildParams(e.currentTarget);
			e.stopPropagation();
		});
		newVar.querySelector('button.del-param').addEventListener('click', e => {this.delParam(e.currentTarget);});
		newVar.querySelector('input.variable').focus();
	}
	
	buildParams(button, testValues=true) {
		let paramsDiv = this.queryTab(button)
			.querySelector('.sqlParams');
		let rows = paramsDiv.querySelectorAll('tr');
		let params = {};
		const nameRegex = /^[a-z_A-Z][a-z_A-Z0-9]*$/;
		rows.forEach(curr => {
			let varField = curr.querySelector('.variable');
			let variable = varField.value;
			let type = curr.querySelector('.type').value;
			let valField = curr.querySelector('.value');
			let value = valField.value;
			let [pattern, dflt, fmt, disabled, placeholder] = this.fieldTypes[type];
			if (!nameRegex.test(variable)) {
				alert(`invalid variable name ${variable}`);
				varField.focus();
				return;
			}
			if (variable in params) {
				alert(`variable ${variable} already defined`);
				varField.focus();
				return;
			}
			let regex = new RegExp(pattern);
			if (testValues && !regex.test(value)) {
				alert(`value of ${variable} doesn't match ${type}`);
				valField.focus();
				return;
			}
			params[variable] = fmt(value);
		});
		return params;
	}
	
	makeParams(button) {
		let params = this.buildParams(button, false);
		let query = this.queryTab(button)
			.querySelector('.query').value;
		let paramRe = /:([a-z_A-Z][a-z_A-Z0-9]*)/g;
		let param;
		while (param = paramRe.exec(query)) {
			if (!(param[1] in params)) {
				this.addParam(button, param[1]);
				params[param[1]] = null;
			}
		}
	}
	
	addSnippets = (snippets) => {
		for (let [name, query] of Object.entries(snippets)) {
			this.snippets[name] = query;
		}
		this.buildSnippetsMenu();
	}
	
	buildSnippetsMenu = () => {
		let snippets = Object.keys(this.snippets)
			.map(
				name => 
				`<tr>
				<td class="snippet-name">${name}</td>
				<td><button class="snippet-cp">cp</button></td>
				<td><button class="snippet-open">open</button></td>
				</tr>`
			)
			.reduce((a, b) => a + b, '');
		let target = this.sqlQuery
			.querySelector('.snippetsMenu');
		target.textContent = '';
		target.insertAdjacentHTML('beforeend', snippets);
		target.querySelectorAll('button.snippet-cp').forEach(
			button => button.addEventListener('click', e => {this.cpSnippet(null, e.currentTarget);}));
		target.querySelectorAll('button.snippet-open').forEach(
			button => button.addEventListener('click', e => {this.openSnippet(null, e.currentTarget);}));
	}
	
	snippetQuery(snippet, preprocessed=false) {
		let query = this.snippets[snippet];
		if (preprocessed) {
			query = this.prepQuery(query);
		}
		if (query) {
			query = this.unindent(query);
		}
	}
	
	currentSnippet(snippet, currentTarget) {
		if (!snippet) {
			snippet = currentTarget
				.closest('tr')
				.querySelector('td.snippet-name')
				.textContent;
		}
		return snippet;
	}
	
	cpSnippet(snippet, currentTarget, data) {
		snippet = this.currentSnippet(snippet, currentTarget);
		let query = data || this.snippets[snippet];
		query = this.unindent(query);
		navigator.clipboard.writeText(query).then(
			() => {
				//alert('clipboard successfully set');
			},
			() => {
				alert('clipboard write failed');
			},
		);
	}
	
	openSnippet(snippet, currentTarget, data) {
		snippet = this.currentSnippet(snippet, currentTarget);
		let query = data || this.snippets[snippet];
		query = this.unindent(query);
		this.addQueryTab(snippet, query);
	}
	
	ppQuery(button) {
		let queryElem = this.queryTab(button)
			.querySelector('.query');
		let query = queryElem.value;
		query = this.prepQuery(query);
		queryElem.value = query;
	}
	
	logQuery(button) {
		let queryElem = this.queryTab(button)
			.querySelector('.query');
		let query = queryElem.value;
		console.log('query0:', queryElem, query);
		query = this.prepQuery(query);
		console.log('query:', query);
	}
	
	async runQuery(button, query, timeLabel) {
		let params = this.buildParams(button);
		let queryTab = this.queryTab(button);
		let queryElem = queryTab.querySelector('.query');
		let tabLabel = queryTab.dataset.tabLabel;
		let target = queryTab.querySelector('.sqlResults');
		
		let started = Date.now();
		let [rows, cols] = await this.sql(
			query || queryElem.value, params, timeLabel || tabLabel);
		this.showTable(target, rows, cols, Date.now() - started);
	}
	
	hexBytes() {
		if (!this.byteToHex) {
			this.byteToHex = [];
			for (let n = 0; n <= 0xff; ++n) {
				const hexOctet = n.toString(16).padStart(2, '0').toUpperCase();
				this.byteToHex.push(hexOctet);
			}
		}
		return this.byteToHex;
	}
	
	hex(arrayBuffer) {
		const buff = new Uint8Array(arrayBuffer);
		return this.hexUint8(buff);
	}
	
	hexUint8(buff) {
		const hexOctets = []; // new Array(buff.length) is even faster (preallocates necessary array size), then use hexOctets[i] instead of .push()
		let byteToHex = this.hexBytes();
		
		for (let i = 0; i < buff.length; ++i) {
			hexOctets.push(byteToHex[buff[i]]);
		}
		return hexOctets.join('');
	}
	
	showTable(target, results, colnames, duration=0) {
		let logRows=false;
		target.textContent = '';
		if (results.length) {
			//let colnames = Object.keys(results[0]);
			let columns = colnames
				.map(col => `<th style="position: sticky; top: 0; opacity: 1; background-color: white;">${col}</th>`)
				.reduce((acc, curr) => acc + curr, '');
			target.insertAdjacentHTML(
				'beforeend',
				`<tr>${columns}</tr>`
			);
			for(let row of results) {
				if (logRows) {
					console.log(row);
				}
				row = colnames
					.map(col => row[col])
					.map(col => {
						if (typeof col === 'object') {
							if (col === null) {
								col = '&lt;null&gt;'
							}
							else if (col.constructor == Uint8Array) {
								col = `x'${this.hexUint8(col)}'`;
							}
							else if (col.constructor == ArrayBuffer) {
								col = `x'${this.hex(col)}'`;
							}
							else {
								col = JSON.stringify(col);
							}
						}
						return `<td>${col}</td>`;
					})
					.reduce((acc, curr) => acc + curr, '');
				target.insertAdjacentHTML(
					'beforeend',
					`<tr>${row}</tr>`
				);
			}
			target.insertAdjacentHTML(
				'beforeend',
				`<tr><td colspan="${colnames.length || 1}">
					<span style="background-color: 'green';">${duration} ms</span>
				</td></tr>`
			);
		}
		else {
			target.insertAdjacentHTML(
				'beforeend',
				`<tr><td><span style="background-color: 'green';">no results</span></td></tr>`
			);
		}
	}
	
	async mapQuery(button, query) {
		let params = this.buildParams(button);
		let queryTab = this.queryTab(button);
		let queryElem = queryTab.querySelector('.query');
		let tabId = queryTab.dataset.tabValue;
		let tabLabel = queryTab.dataset.tabLabel;
		
		let [rows, cols] = await this.sql(query || queryElem.value, params, tabLabel);
		if (!cols.includes('feature')) {
			alert('provide a geojson column named "feature"');
			return;
		}
		this.showLayer(tabId, tabLabel,rows);
	}
	
	showLayer(tabId, tabLabel, rows) {
		let vectorSource = new ol.source.Vector();
		let dataProjection = 'EPSG:900913';
		let featureProjection = 'EPSG:3857';
		const formatJson = new ol.format.GeoJSON();
		for (let row of rows) {
			let {feature, ...properties} = row;
			let features2style = [feature];
			if (!['Feature', 'FeatureCollection'].includes(feature.type)) {
				feature = {
					type: 'Feature',
					properties,
					geometry: feature,
				}
				features2style = [feature];
			}
			else if (feature.type == 'FeatureCollection') {
				dataProjection = 
					(feature?.crs?.properties?.name) || dataProjection;
				features2style = feature.features;
			}
			let features = formatJson.readFeatures(feature, {
				dataProjection: dataProjection,
				featureProjection: featureProjection,
			});
			features[0].setProperties(properties);
			vectorSource.addFeatures(features);
		}
		vectorSource.setProperties({
			origProjection: dataProjection,
		});
		const vectorLayer = new ol.layer.Vector({
			title: tabLabel,
			tabId,
			source: vectorSource,
			style: (feature, resolution) => {
				let style;
				if (!feature.get('styled')) {
					let flatstyle = feature.get('flatstyle') || {};
					let parsingContext = ol.expr.expression.newParsingContext();
					style = ol.render.canvas.style.buildStyle(flatstyle, parsingContext)();
					//style = ol.render.canvas.style.flatStylesToStyleFunction(
					//	[flatstyle], feature, resolution);
					//console.log('Style', style);
					feature.setStyle(style);
					feature.set('styled', true);
				}
				style = feature.getStyle();
				return style;
			},
		});
		this.map.addLayer(vectorLayer);
		show_map(this.map, featureProjection, '#hit-tolerance');
	}
	
	delParam(_this) {
		let tr = _this.closest('tr');
		let ok = confirm(`delete ${tr.querySelector('.variable').value} ?`);
		if (ok) {
			tr.parentNode.removeChild(tr);
		}
	}
	
	unindent(text, tabSpaces=4) {
		let spaceRep = ' '.repeat(tabSpaces);
		let minIndent = text.match(/^\s+/gm)
			.map(indent => indent
				.replaceAll(spaceRep, '\t')
				.length)
			.reduce((a, b) => Math.min(a, b));
		text = text.replace(
			/^\s+/gm,
			match => match.replaceAll(spaceRep, '\t')
		);
		return text.replaceAll(
			new RegExp('^' + '\t'.repeat(minIndent), 'gm'), '');
	}
	
	indent = (text, nTabs=0, tabSpaces=4) => {
		const nlRe = /\r\n|(?!\r\n)[\n-\r\x85\u2028\u2029]/;
		text = this.unindent(text, tabSpaces);
		let prefix = '\t'.repeat(nTabs);
		text = text.split(nlRe)
			.map(line => prefix + line)
			.reduce((a, b) => a + '\n' + b)
			;
		console.log(nTabs, text);
		//console.log(text);
		return text;
	}
	
	uncomment(text) {
		let commentRe = /(\/\*([^*]|[\r\n]|(\*+([^*\/]|[\r\n])))*\*+\/)|(\/\/.*)|(--.*)/g;
		return text.replaceAll(commentRe, '');
	}
	
	prepQuery(query, uncomment=false) {
		const snippetRe = /\$\((.*?)\)/g;
		if (uncomment) {
			query = this.uncomment(query);
		}
		let depth = 0;
		const replacer = (match, snippet) => {
			let replaced = this.snippets[snippet];
			++depth;
			replaced = this.indent(replaced, depth);
			replaced = `(\n${replaced})`;
			replaced = replaced.replace(snippetRe, replacer);
			--depth;
			if (uncomment) {
				replaced = this.uncomment(replaced);
			}
			return replaced;
		};
		return query.replace(snippetRe, replacer);
	}
	
	prepKeys(obj, query, label) {
		let params = obj;
		if (false) warn(label);
		if (!query) {
			throw new Error('the query is empty');
		}
		query = this.prepQuery(query, true);
		if (Array.isArray(obj)) {
			return [params, query];
		}
		const paramRe = /:[a-z_A-Z][a-z_A-Z0-9]*/g;
		if (typeof(obj) == 'object') {
			params = {};
			let paramRe = /:([a-z_A-Z][a-z_A-Z0-9]*)/g;
			let param;
			while (param = paramRe.exec(query)) {
				let val = obj[param[1]];
				if (typeof(val) == 'undefined') {
					throw new Error(
						`parameter ${param[1]} not defined for ${label}.`);
				}
				params[param[0]] = val;
			}
		}
		return [params, query];
	}
	
	async sql(query, params={}, timeLabel) {
		[params, query] = this.prepKeys(params, query, timeLabel);
		if (timeLabel) {
			console.time(timeLabel);
		}
		let rs = this.db.exec(query, params).get;
		let cols = await rs.cols;
		let rows = await rs.objs;
		if (timeLabel) {
			console.timeEnd(timeLabel);
		}
		return [rows, cols];
	}
	
	buildForm() {
		let html = `
			<!--
			the code for the tabbed ui comes from
			https://www.geeksforgeeks.org/how-to-create-tabs-containing-different-content-in-html/amp/
			-->
			<style>
				/*
				* {
					margin: 0;
					padding: 0;
				}
				body {
					background: white;
				}
				.container {
					border: 1px solid grey;
					margin: 1rem;
				}
				*/
				[data-tab-info] {
					display: none;
				}
				.active[data-tab-info] {
					display: block;
				}
				.tab-content {
					margin-top: 1rem;
					/*
					padding-left: 1rem;
					font-size: 20px;
					font-family: sans-serif;
					font-weight: bold;
					color: rgb(0, 0, 0);
					*/
				}
				.tabs {
					border-bottom: 1px solid grey;
					background-color: rgb(16, 153, 9);
					/*
					font-size: 25px;
					*/
					color: rgb(0, 0, 0);
					/***
					display: flex;
					***/
					margin: 0;
				}
				.tabs span {
					background: rgb(16, 153, 9);
					padding: 10px;
					border: 1px solid rgb(255, 255, 255);
					
					float: inline-start;
				}
				.tabs span:hover, .tabs span.active {
					background: rgb(55, 219, 46);
					cursor: pointer;
					color: black;
				}
				.tabs span.new-query {
					float: inline-end !important;
				}
				.tabs span.tab-close {
					padding: 0;
					margin: 0;
					border: 0;
					float: none;
				}
				.tab-content {
					clear: both;
				}
			</style>
			<div class="tabs">
				<span class="new-query">+</span>
			</div>
			<div class="tab-content">
			</div>
		`;
		this.sqlQuery.textContent = '';
		this.sqlQuery.insertAdjacentHTML('beforeend', html);
		this.createTab(
			'snippets', `
			<table border="1"><tbody class="snippetsMenu"></tbody></table>`
		);
		this.sqlQuery.querySelector('.new-query')
			.addEventListener('click', e => {this.addQueryTab()});
		this.buildSnippetsMenu();
		this.addQueryTab();
	}
	
	tabClick = tab => {
		const tabs = this.sqlQuery
			.querySelectorAll('[data-tab-value]');
		tabs.forEach(tab => {
			tab.classList.remove('active')
		});
		const target = this.sqlQuery
			.querySelector(tab.dataset.tabValue);
		const tabInfos = this.sqlQuery
			.querySelectorAll('[data-tab-info]');
		tabInfos.forEach(tabInfo => {
			tabInfo.classList.remove('active')
		});
		if (tab && target) {
			tab.classList.add('active');
			target.classList.add('active');
		}
	}
	
	tabOnClick = tab => {
		tab.addEventListener('click', e => {this.tabClick(tab)});
	}
	
	createTab(label, content, withClose=false) {
		let _class = `tab_${++this.tabCounter}`;
		if (!label) {
			label = `query ${this.tabCounter}`;
		}
		let tabs = this.sqlQuery.querySelector('.tabs');
		let closeX = withClose ? '&nbsp;<span class="tab-close">x</span>' : '';
		tabs.insertAdjacentHTML(
			'beforeend',
			`<span data-tab-value=".${_class}">
				${label}${closeX}
			</span>`
		);
		let tabInfos = this.sqlQuery.querySelector('.tab-content');
		tabInfos.insertAdjacentHTML(
			'beforeend',
			`<div class="tabs__tab ${_class}" data-tab-info="${_class}" data-tab-label="${label}">
				${content}
			</div>`
		);
		let tab = tabs.querySelector(`span[data-tab-value=".${_class}"]`);
		if (withClose) {
			tab.querySelector('.tab-close')
				.addEventListener('click', e => {
					this.tabClose(e.currentTarget);
					e.stopPropagation();
				});
		}
		let tabInfo = tabInfos.querySelector(`div[data-tab-info="${_class}"]`);
		this.tabOnClick(tab);
		return [tab, tabInfo];
	}
	
	addQueryTab = (label, query='') => {
		let html = `
			<table border="0"><tbody class="sqlParams"></tbody></table>
			<div>
				<button class="add-param">add param</button>
				<button class="make-params">make params</button>
				<button class="pp-query">pp</button>
				<button class="log-query">log</button>
				<button class="run-query">run</button>
				<button class="map-query">map</button>
			</div>
			<textarea class="query" style="width: 96vw; white-space: nowrap; tab-size: 4;" wrap="soft" spellcheck="false" placeholder="select 'hello';" rows="7"></textarea>
			<div style="width: 96vw; height: 60vh; overflow: auto; border: solid;">
				<table border="1"><tbody class="sqlResults"></tbody></table>
			</div>
			`;
		let [tab, tabInfo] = this.createTab(label, html, true);
		tabInfo.querySelector('.query').value = query;
		tabInfo.querySelector('button.add-param')
			.addEventListener('click', e => {this.addParam(e.currentTarget);});
		tabInfo.querySelector('button.make-params')
			.addEventListener('click', e => {this.makeParams(e.currentTarget);});
		tabInfo.querySelector('button.pp-query')
			.addEventListener('click', e => {this.ppQuery(e.currentTarget);});
		tabInfo.querySelector('button.log-query')
			.addEventListener('click', e => {this.logQuery(e.currentTarget);});
		tabInfo.querySelector('button.run-query')
			.addEventListener('click', e => {this.runQuery(e.currentTarget);});
		tabInfo.querySelector('button.map-query')
			.addEventListener('click', e => {this.mapQuery(e.currentTarget);});
		this.tabClick(tab);
	}
		
	tabClose = button => {
		let tab = button.closest('span[data-tab-value]');
		let target = this.sqlQuery
			.querySelector(tab.dataset.tabValue);
		let tab_1;
		if (Object.values(target.classList).includes('active')) {
			tab_1 = this.sqlQuery.querySelector('span[data-tab-value=".tab_1"]');
		}
		tab.remove();
		target.remove();
		if (tab_1) {
			this.tabClick(tab_1);
		}
	}
};

