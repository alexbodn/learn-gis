
'use strict';

function uncomment(text) {
	let commentRe = /(\/\*([^*]|[\r\n]|(\*+([^*\/]|[\r\n])))*\*+\/)|(\/\/.*)|(--.*)/g;
	return text.replaceAll(commentRe, '');
}

class SQLQuery {
	
	fieldTypes = {
		NULL: ['^$', '', x => null, true, 'null'],
		INTEGER: ['^([+-]?[1-9]\\d*([Ee][+-]?[1-9]\\d*)?|0)$', '', parseInt, false, '123'],
		REAL: ['^[+-]?(([1-9]\\d*(\\.\\d*)?([Ee][+-]?[1-9]\\d*)?|0)|Infinity)$', '', parseFloat, false, '123.45'],
		TEXT: ['.*', '', x => x, false, 'abc'],
		BLOB: ['.*', '', x => x, false, 'abc'],
		DATETIME: ['^[1-9]\\d{3}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$', '', x => parseDate(x), false, '2009-09-28T09:15:15'],
	};
	
	snippets = {
		sqliteAllTables: `
			SELECT name
			FROM sqlite_schema
			WHERE type ='table' AND 
				name NOT LIKE 'sqlite_%';`,
		allDbs: `
			select * 
			from PRAGMA_database_list`,
		attachDb: `
			ATTACH DATABASE '/proj/proj.db' AS proj`,
		xyncolor: `
			select null as x, null as y, null as n, null as color where 0
			union all
			VALUES
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
					'fill-opacity', 0.1,
					'stroke-color', color,
					'stroke-width', 2,
					'text', 
					json_object(
						'text', cast (n as text)
					--	'fill-color', color,
					--	'stroke-color', color
					)
				) as style,
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
						'style', json(style)
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
	};
	
	constructor(selector, db, thisName, snippets, map) {
		this.sqlQuerySelector = selector;
		this.db = db;
		this.thisName = thisName;
		if (snippets) {
			this.snippets = snippets;
		}
		if (map) {
			this.map = map;
		}
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
	
	addParam(name='') {
		function typeOptions(fieldTypes) {
			return Object.keys(fieldTypes)
				.map(type => `<option value="${type}" ${type == 'NULL' ? 'selected="selected"' : ''}>${type}</option>`)
				.reduce((a, b) => (a + '\n' + b), '')
				;
		}
		let row = `
			<tr>
				<td style="width: 30%">
					<input class="variable" onblur="${this.thisName}.buildParams(false)" type="text" value="${name}" placeholder="name" style="width: 100%" />
				</td>
				<td style="width: 30%">
					<select class="type" style="width: 100%" onchange="${this.thisName}.paramType(this);">
						${typeOptions(this.fieldTypes)}
					</select>
				</td>
				<td style="width: 30%">
					<input class="value" onblur="${this.thisName}.buildParams()" pattern="/^$/" disabled="disabled" value="" placeholder="null" style="width: 100%" />
				</td>
				<td style="width: 10%"><button onclick="${this.thisName}.delParam(this)">del</button></td>
			</tr>
			`;
		let params = document.querySelector(this.sqlQuerySelector + ' .sqlParams');
		params.insertAdjacentHTML('beforeend', row);
		params.querySelector('tr:last-child input.variable').focus();
	}
	
	buildParams(testValues=true) {
		let paramsDiv = document.querySelector(this.sqlQuerySelector + ' .sqlParams');
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
	
	makeParams() {
		let params = this.buildParams(false);
		let query = document.querySelector(this.sqlQuerySelector + ' .query').value;
		let paramRe = /:([a-z_A-Z][a-z_A-Z0-9]*)/g;
		let param;
		while (param = paramRe.exec(query)) {
			if (!(param[1] in params)) {
				this.addParam(param[1]);
				params[param[1]] = null;
			}
		}
	}
	
	addSnippets(snippets) {
		for (let [name, query] of Object.entries(snippets)) {
			this.snippets[name] = query;
		}
		this.buildSnippetsMenu();
	}
	
	buildSnippetsMenu() {
		let snippets = Object.keys(this.snippets)
			.map(
				name => 
				`<tr>
				<td>${name}</td>
				<td><button onclick="${this.thisName}.pasteSnippet('${name}');">paste</button></td>
				<td><button onclick="${this.thisName}.runSnippet('${name}');">run</button></td>
				</tr>`
			)
			.reduce((a, b) => a + b, '');
		let target = document.querySelector(`${this.sqlQuerySelector} .snippetsMenu`);
		target.textContent = '';
		target.insertAdjacentHTML('beforeend', snippets);
	}
	
	pasteSnippet(snippet) {
		if (snippet in this.snippets) {
			let queryElem = document.querySelector(`${this.sqlQuerySelector} .query`);
			queryElem.value = this.snippets[snippet].replace(/\n\s+/g, '\n');
		}
	}
	
	runSnippet(snippet) {
		if (snippet in this.snippets) {
			return this.runQuery(this.snippets[snippet]);
		}
	}
	
	async runQuery(query) {
		let params = this.buildParams();
		let queryElem = document.querySelector(`${this.sqlQuerySelector} .query`);
		
		let [rows, cols] = await this.sql(query || queryElem.value, params);
		this.showTable(rows, cols);
	}
	
	showTable(results, colnames, logRows=false) {
		let target = document.querySelector(`${this.sqlQuerySelector} .sqlResults`);
		target.textContent = '';
		if (results.length) {
			//let colnames = Object.keys(results[0]);
			let columns = colnames
				.map(col => `<th>${col}</th>`)
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
					//.map(col => `<td>${row[col]}</td>`)
					.map(col => row[col])
					.map(col => `<td>${typeof col === 'object' ? JSON.stringify(col) : col}</td>`)
					.reduce((acc, curr) => acc + curr, '');
				target.insertAdjacentHTML(
					'beforeend',
					`<tr>${row}</tr>`
				);
			}
		}
		else {
			target.insertAdjacentHTML(
				'beforeend',
				`<tr><td>no results</td></tr>`
			);
		}
	}
	
	async addLayer(query) {
		let params = this.buildParams();
		let queryElem = document.querySelector(`${this.sqlQuerySelector} .query`);
		
		let [rows, cols] = await this.sql(query || queryElem.value, params);
		this.showLayer(rows);
	}
	
	parseStyleRule = (key, value) => {
		let ix = key.search('-');
		if (ix >= 0) {
			value = this.parseStyleRule(key.slice(ix+1), value);
			key = key.slice(0, ix);
		}
		let parsed = {};
		parsed[key] = value;
		return parsed;
	}
	
	mergeStyleRules = (rule, merged) => {
		for (let [key, value] of Object.entries(rule)) {
			if (key in merged && merged[key]) {
				if (typeof merged[key] === 'object') {
					this.mergeStyleRules(value, merged[key]);
				}
				else {
					merged[key] = value;
				}
			}
			else {
				merged[key] = value;
			}
		}
	}
	
	parseStyle(styleSource) {
		let rules = Object.entries(styleSource)
			.map(rule => this.parseStyleRule(...rule));
		let merged = {};
		for (let rule of rules) {
			this.mergeStyleRules(rule, merged);
		}
		let style = {};
		for (let key in merged) {
			let cls = key.charAt(0).toUpperCase() +
				key.substr(1).toLowerCase();
			if (cls in ol.style) {
				style[key] = new ol.style[cls](merged[key]);
			}
		}
		return Object.keys(style).length
			? new ol.style.Style(style) : null;
	}
	
	showLayer(rows) {
		let title = prompt(
			'the layer title please',
			'query layer',
		);
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
			for (let feat of features2style) {
				let styleSource = feat?.properties?.style || {};
				let style = this.parseStyle(styleSource);
				if (!('properties' in feat)) {
					feat.properties = {};
				}
				feat.properties.style = style;
				//console.log(style, feat.getStyle());
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
			title: title,
			source: vectorSource,
			style: feature => feature.get('style'),
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
	
	prepKeys(obj, query, label) {
		let params = obj;
		if (false) warn(label);
		if (Array.isArray(obj)) {
			return obj;
		}
		const snippetRe = /\$\((.*?)\)/g;
		query = uncomment(query);
		const replacer = (match, snippet) => {
			let replaced = this.snippets[snippet].replace(snippetRe, replacer)
			replaced = uncomment(replaced);
			return `(
				${replaced}
			)`;
		};
		query = query.replace(snippetRe, replacer);
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
	
	async sql(query, params={}) {
		let [_params, _query] = this.prepKeys(params, query);
		let cols = await this.db.exec(
			_query,
			_params,
		).get.cols;
		let rows = await this.db.exec(
			_query,
			_params,
		).get.objs;
		return [rows, cols];
	}
	
	buildForm() {
		let html = `
			<table border="0"><tbody class="sqlParams"></tbody></table>
			<div>
				<button onclick="${this.thisName}.addParam()">add param</button>
				<button onclick="${this.thisName}.makeParams()">make params</button>
				<button onclick="${this.thisName}.runQuery()">run</button>
				<button onclick="${this.thisName}.addLayer()">add layer</button>
			</div>
			<textarea class="query" style="width: 100%" placeholder="select 'hello';" rows="7"></textarea>
			<table border="1"><tbody class="snippetsMenu"></tbody></table>
			<table border="1"><tbody class="sqlResults"></tbody></table>
		`;
		let target = document.querySelector(this.sqlQuerySelector);
		target.textContent = '';
		target.insertAdjacentHTML('beforeend', html);
		this.buildSnippetsMenu();
	}
};

