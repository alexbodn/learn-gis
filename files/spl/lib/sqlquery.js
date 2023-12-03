
'use strict';

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
		compileOptions: `
			select * 
			from PRAGMA_compile_options`,
		attachDb: `
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
					100+40 * sin(value * radians(360) / 5),
					100+40 * cos(value * radians(360) / 5),
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
			' as pinpng) on 1=1
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
		let params = this.sqlQuery.querySelector('.sqlParams');
		params.insertAdjacentHTML('beforeend', row);
		let newVar = params.querySelector('tr:last-child');
		newVar.querySelector('input.variable').addEventListener('blur', e => {this.buildParams(false);});
		newVar.querySelector('select.type').addEventListener('change', e => {this.paramType(e.currentTarget);});
		newVar.querySelector('input.value').addEventListener('blur', e => {this.buildParams();});
		newVar.querySelector('button.del-param').addEventListener('click', e => {this.delParam(e.currentTarget);});
		newVar.querySelector('input.variable').focus();
	}
	
	buildParams(testValues=true) {
		let paramsDiv = this.sqlQuery.querySelector('.sqlParams');
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
		let query = this.sqlQuery.querySelector('.query').value;
		let paramRe = /:([a-z_A-Z][a-z_A-Z0-9]*)/g;
		let param;
		while (param = paramRe.exec(query)) {
			if (!(param[1] in params)) {
				this.addParam(param[1]);
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
				<td><button class="snippet-paste">paste</button></td>
				<td><button class="snippet-copy">cp</button></td>
				<td><button class="snippet-pp">pp</button></td>
				<td><button class="snippet-run">run</button></td>
				<td><button class="snippet-map">map</button></td>
				</tr>`
			)
			.reduce((a, b) => a + b, '');
		let target = this.sqlQuery.querySelector('.snippetsMenu');
		target.textContent = '';
		target.insertAdjacentHTML('beforeend', snippets);
		target.querySelectorAll('button.snippet-paste').forEach(
			button => button.addEventListener('click', e => {this.pasteSnippet(null, e.currentTarget);}));
		target.querySelectorAll('button.snippet-copy').forEach(
			button => button.addEventListener('click', e => {this.copySnippet(null, e.currentTarget);}));
		target.querySelectorAll('button.snippet-pp').forEach(
			button => button.addEventListener('click', e => {this.unfoldSnippet(null, e.currentTarget);}));
		target.querySelectorAll('button.snippet-run').forEach(
			button => button.addEventListener('click', e => {this.runSnippet(null, e.currentTarget);}));
		target.querySelectorAll('button.snippet-map').forEach(
			button => button.addEventListener('click', e => {this.mapSnippet(null, e.currentTarget);}));
	}
	
	snippetQuery(snippet, preprocessed=false) {
		let query = this.snippets[snippet];
		if (preprocessed) {
			query = this.prepQuery(query);
		}
		if (query) {
			query = query.replace(/\n\s+/g, '\n');
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
	
	pasteSnippet(snippet, currentTarget) {
		snippet = this.currentSnippet(snippet, currentTarget);
		if (snippet in this.snippets) {
			let queryElem = this.sqlQuery.querySelector('.query');
			queryElem.value = this.snippets[snippet].replace(/\n\s+/g, '\n');
		}
	}
	
	copySnippet(snippet, currentTarget, data) {
		snippet = this.currentSnippet(snippet, currentTarget);
		let query = data || this.snippets[snippet].replace(/\n\s+/g, '\n');
		navigator.clipboard.writeText(query).then(
			() => {
				//alert('clipboard successfully set');
			},
			() => {
				alert('clipboard write failed');
			},
		);
	}
	
	unfoldSnippet(snippet, currentTarget) {
		snippet = this.currentSnippet(snippet, currentTarget);
		let query = this.snippets[snippet];
		query = this.prepQuery(query);
		return this.copySnippet(
			snippet, currentTarget,
			query.replace(/\n\s+/g, '\n'));
	}
	
	runSnippet(snippet, currentTarget) {
		snippet = this.currentSnippet(snippet, currentTarget);
		if (snippet in this.snippets) {
			return this.runQuery(this.snippets[snippet]);
		}
	}
	
	mapSnippet(snippet, currentTarget) {
		snippet = this.currentSnippet(snippet, currentTarget);
		if (snippet in this.snippets) {
			return this.mapQuery(this.snippets[snippet]);
		}
	}
	
	async runQuery(query) {
		let params = this.buildParams();
		let queryElem = this.sqlQuery.querySelector('.query');
		
		let [rows, cols] = await this.sql(query || queryElem.value, params);
		this.showTable(rows, cols);
	}
	
	showTable(results, colnames, logRows=false) {
		let target = this.sqlQuery.querySelector('.sqlResults');
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
	
	async mapQuery(query) {
		let params = this.buildParams();
		let queryElem = this.sqlQuery.querySelector('.query');
		
		let [rows, cols] = await this.sql(query || queryElem.value, params);
		if (!cols.includes('feature')) {
			console.error('provide a geojson column named "feature"');
			return;
		}
		this.showLayer(rows);
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
	
	uncomment(text) {
		let commentRe = /(\/\*([^*]|[\r\n]|(\*+([^*\/]|[\r\n])))*\*+\/)|(\/\/.*)|(--.*)/g;
		return text.replaceAll(commentRe, '');
	}
	
	prepQuery(query, uncomment=false) {
		const snippetRe = /\$\((.*?)\)/g;
		if (uncomment) {
			query = this.uncomment(query);
		}
		const replacer = (match, snippet) => {
			let replaced = this.snippets[snippet].replace(snippetRe, replacer)
			if (uncomment) {
				replaced = this.uncomment(replaced);
			}
			return `(
				${replaced}
			)`;
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
	
	async sql(query, params={}) {
		[params, query] = this.prepKeys(params, query);
		let rs = this.db.exec(query, params).get;
		let cols = await rs.cols;
		let rows = await rs.objs;
		return [rows, cols];
	}
	
	buildForm() {
		let html = `
			<table border="0"><tbody class="sqlParams"></tbody></table>
			<div>
				<button class="add-param">add param</button>
				<button class="make-params">make params</button>
				<button class="run-query">run</button>
				<button class="map-query">map</button>
			</div>
			<textarea class="query" style="width: 100%" placeholder="select 'hello';" rows="7"></textarea>
			<table border="1"><tbody class="snippetsMenu"></tbody></table>
			<table border="1"><tbody class="sqlResults"></tbody></table>
		`;
		this.sqlQuery.textContent = '';
		this.sqlQuery.insertAdjacentHTML('beforeend', html);
		this.buildSnippetsMenu();
		this.sqlQuery.querySelector('button.add-param').addEventListener('click', e => {this.addParam();});
		this.sqlQuery.querySelector('button.make-params').addEventListener('click', e => {this.makeParams();});
		this.sqlQuery.querySelector('button.run-query').addEventListener('click', e => {this.runQuery();});
		this.sqlQuery.querySelector('button.map-query').addEventListener('click', e => {this.mapQuery();});
	}
};

