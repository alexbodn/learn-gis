
'use strict';

//todo
//copy results as json array of objects
//eventually zipped
//if no map try creation of leaflet map
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

//code taken from
//https://stackoverflow.com/a/41797377/4444742
function hexToBase64(hexstring) {
	return btoa(hexstring.match(/\w{2}/g).map(function(a) {
		return String.fromCharCode(parseInt(a, 16));
	}).join(""));
}
//hexToBase64("a6b580481008e60df9350de170b7e728");

//code taken from
//https://stackoverflow.com/a/62365404/4444742
function bytesArrToBase64(arr) {
	const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; // base64 alphabet
	const bin = n => n.toString(2).padStart(8,0); // convert num to 8-bit binary string
	const l = arr.length
	let result = '';

	for(let i=0; i<=(l-1)/3; i++) {
		let c1 = i*3+1>=l; // case when "=" is on end
		let c2 = i*3+2>=l; // case when "=" is on end
		let chunk = bin(arr[3*i]) + bin(c1? 0:arr[3*i+1]) + bin(c2? 0:arr[3*i+2]);
		let r = chunk.match(/.{1,6}/g).map((x,j)=> j==3&&c2 ? '=' :(j==2&&c1 ? '=':abc[+('0b'+x)]));
		result += r.join('');
	}

	return result;
}

function hexToBytes(hexString) {
	return hexString.match(/.{1,2}/g).map(x=> +('0x'+x));
}
/*
let hexString = "a6b580481008e60df9350de170b7e728";
let bytes = hexToBytes(hexString);
let base64 = bytesArrToBase64(bytes);
*/

function getMimeTypeFromHex(hexString) {
	let prefixes = {
		'89504E47': 'image/png',
		'47494638': 'image/gif',
		'25504446': 'application/pdf',
		'FFD8FFDB': 'image/jpeg',
		'FFD8FFE0': 'image/jpeg',
		'504B0304': 'application/zip',
	};
	for (let [prefix, mime] of Object.entries(prefixes)) {
		if (hexString.startsWith(prefix)) {
			return mime;
		}
	}
	return null;
}

//code taken from
//https://stackoverflow.com/a/10727155/4444742
const randomVar = (length=32) => {
	let chars = '0123456789abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	let result = '_';
	for (let i = length - 1; i > 0; --i) {
		result += chars[Math.floor(Math.random() * chars.length)];
	}
	return result in window ? randomVar(length) : result;
}

//code from
//https://stackoverflow.com/a/36535220/4444742
function walkDOM(node, func, filter) {
	if (filter && !filter(node)) {
		return;
	}
	func(node);
	node = node.firstChild;
	while(node) {
		walkDOM(node, func, filter);
		node = node.nextSibling;
	}
};

//code provided at
//https://stackoverflow.com/a/1388022/4444742
function getStyleProperty(elem, property)
{
	if (window.getComputedStyle) {
		return document.defaultView
			.getComputedStyle(elem,null)
			.getPropertyValue(property); 
	}
	else if (elem.currentStyle) {
		return elem.currentStyle[property];
	}
}

function isElement($obj) {
	try {
		return ($obj.constructor.__proto__.prototype.constructor.name === 'HTMLElement');
	}catch(e){
		return false;
	}
}

function gridTree(rows, row0=0, col0=0, last=null) {
	
	if (row0 >= rows.length || col0 >= rows[row0].length) {
		return;
	}
	let summary = rows[row0][col0];
	if (!summary) {
		return;
	}
	let row = row0;
	if (last === null) {
		last = rows.length;
	}
	let result = [];
	for(++row; row < last; ++row) {
		if (summary != rows[row][col0]) {
			let details = gridTree(rows, row0, col0 + 1, row);
			result.push({summary, details});
			row0 = row;
			summary = rows[row0][col0];
		}
	}
	if (row > row0) {
		let details = gridTree(rows, row0, col0 + 1, row);
		result.push({summary, details});
	}
	return result;
}

/*
the code for the tree view originates
is from https://iamkate.com/code/tree-views/
*/
function htmlTree(tree) {
	const htmlNode = node => {
		return node.details ? `
			<li class="details"><details>
				<summary>${node.summary}</summary>
				${htmlTree(node.details)}
			</details></li>` :
			`<li class="leaf">${node.summary}</li>`;
	}
	return `<ul>${tree.map(htmlNode).join('\n')}</ul>`;
}

const snippets = {
	schemaTree: {
		query: `
SELECT
'tables' as tables,
tbl_name ||
case
when sqlite_schema.type='index'
	then ' (table)'
else ' (' || sqlite_schema.type || ')'
end as entity,
case
when sqlite_schema.type='index'
	then 'index ' || sqlite_schema.name
when sqlite_schema.type='trigger'
	then null
else 'columns'
end as [group],
case
when sqlite_schema.type='index'
	then index_fields.name
else table_fields.name || ' ' ||
table_fields.type ||
(case when [notnull]>0 then ' not null' else '' end) ||
(case when dflt_value is not null then ' default(' || cast(dflt_value as TEXT) || ')' else '' end) ||
(case when pk>0 then ' primary key' else '' end)
end as field
FROM sqlite_schema
left outer JOIN pragma_table_info(sqlite_schema.name) table_fields
left outer JOIN pragma_index_info(sqlite_schema.name) index_fields
WHERE sqlite_schema.name NOT LIKE 'sqlite_%'
and sqlite_schema.type<>'view'
order by 
tbl_name, 
sqlite_schema.type desc,
[group],
coalesce(table_fields.cid, 0),
coalesce(index_fields.seqno, 0)
		`,
		spatial: false,
	},
	gpkgSchema: {
		query: `
SELECT 
'gpkg' as gpkg,
data_type,
gpkg_contents.table_name,
'column ' || column_name || ' ' || 
geometry_type_name || ' ' ||
'srs_id ' || cast (gpkg_geometry_columns.srs_id as TEXT) || ' ' ||
'x y' ||
case when z<>0 then ' z' else '' end ||
case when m<>0 then ' m' else '' end
as column
FROM gpkg_contents
left outer join gpkg_geometry_columns 
on gpkg_contents.table_name=gpkg_geometry_columns.table_name
			`,
		spatial: false,
	},
	spatialiteSchema: {
		query: `
select 'geometries', 'tables',
f_table_name as [table],
f_geometry_column || ' ' ||
cast (geometry_type as TEXT) as column
from geometry_columns
union all
select 'geometries', 'views',
view_name as [view],
view_geometry as geometry
from views_geometry_columns
union all
select 'geometries', 'virts',
virt_name as virt,
virt_geometry as geometry
from virts_geometry_columns
union all
select 'networks',
network_name,
null, null
from networks
union all
select 'topologies',
topology_name,
null, null
from topologies
		`,
		spatial: true,
	},
	allTables: {
		query: `
			SELECT type, name
			FROM sqlite_schema
			WHERE type IN ('table', 'view')
				AND name NOT LIKE 'sqlite_%';`,
		spatial: false,
	},
	tableFields: {
		query: `
			SELECT *
			FROM pragma_table_info('table_name')`,
		spatial: false,
	},
	schema: {
		query: `
			WITH all_tables AS (
				SELECT
					name table_name,
					type table_type
				FROM sqlite_master
				WHERE type = 'table'
			) 
			SELECT table_name, table_type, pti.*
			FROM all_tables at
			INNER JOIN pragma_table_info(table_name) pti
			ORDER BY table_type, table_name, cid`,
		spatial: false,
	},
	allDbs: {
		query: `
			select * 
			from PRAGMA_database_list`,
		spatial: false,
	},
	compileOptions: {
		query: `
			select * 
			from PRAGMA_compile_options`,
		spatial: false,
	},
	attachMountedDb: {
		query: `
			ATTACH DATABASE '/proj/proj.db' AS proj`,
		spatial: false,
	},
	generateSeries: {
		query: `
			SELECT value
			FROM generate_series --(5,100,5)
			where start=5 and stop=50 and step=5`,
		spatial: false,
	},
	pentagonPoints: {
		query: `
			with icons as $(pinpng)
			SELECT
				flatstyle,
				style,
				asgeojson(makepoint(
					100 + 40 * sin((value % 5) * radians(360) / 5),
					100 + 40 * cos((value % 5) * radians(360) / 5),
					3857
				)) as feature
			FROM generate_series as ctr
			inner join icons on 1
			where ctr.start=0 and ctr.stop=5`,
		spatial: false,
	},
	pinpng: {
		query: `
			select
				json_object(
					--'text-value', '',
					'icon-color', '#8959A8',
					'icon-cross-origin', 'anonymous',
					'icon-src', 'data:'||
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
						'
					
					--'circle-stroke-color', 'blue',
					--'circle-stroke-width', 1,
					--'circle-radius', 5
				) as flatstyle,
				json_object(
					--'text-value', '',
					'icon-color', '#8959A8',
					'icon-cross-origin', 'anonymous',
					'iconUrl', 'data:'||
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
						'
					
					--'circle-stroke-color', 'blue',
					--'circle-stroke-width', 1,
					--'circle-radius', 5
				) as style
				`,
		spatial: false,
	},
	xyncolor: {
		query: `
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
			select * from t1`,
		spatial: false,
	},
	polygonGeometries: {
		query: `
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
				json_object(
					'fillColor', color,
					'fillOpacity', 0.05,
					'color', color,
					'opacity', 1,
					'weight', 2
				) as style,
				cast (n as text) as name
			FROM t1`,
		spatial: false,
	},
	polygonFeatures: {
		query: `
			WITH t1 AS $(polygonGeometries)
			SELECT
				json_object(
					'type', 'Feature',
					'geometry', json(Feature),
					'properties',
					json_object(
						'name', name,
						'style', json(style),
						'flatstyle', json(flatstyle)
					)
				) as feature
			FROM t1`,
		spatial: false,
	},
	featuresCollection: {
		query: `
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
			FROM t1`,
		spatial: false,
	},
	builtPolygons: {
		query: `
			WITH t1 AS $(xyncolor)
			SELECT
				cast (n as text) as name,
				json(asgeojson(makepolygon(makeline(point)))) as feature,
				json_object(
					'fill-color', color,
					'fill-opacity', 0.05,
					'stroke-color', color,
					'stroke-width', 2,
					'text-value', cast (n as text)
				) as flatstyle,
				json_object(
					'fillColor', color,
					'fillOpacity', 0.05,
					'color', color,
					'opacity', 1,
					'weight', 2
				) as style
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
			group by n, color`,
		spatial: true,
	},
	builtFeatures: {
		query: `
			WITH t1 AS $(builtPolygons)
			SELECT
				json_object(
					'type', 'Feature',
					'geometry', json(Feature),
					'properties',
					json_object(
						'name', name,
						'style', json(style),
						'flatstyle', json(flatstyle)
					)
				) as feature
			FROM t1`,
		spatial: false,
	},
	builtCollection: {
		query: `
			WITH t1 AS $(builtFeatures)
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
			FROM t1`,
		spatial: true,
	},
	spatiaLiteVersion: {
		query: `
			SELECT spatialite_version()`,
		spatial: true,
	},
	projVersion: {
		query: `
			SELECT proj_version()`,
		spatial: true,
	},
	gpkg_contents: {
		query: `
			SELECT *
			FROM gpkg_contents`,
		spatial: false,
	},
	transform_point: {
		query: `
			with icons as $(pinpng)
			select 
			--aswkt (
			st_transform(
			st_transform(
			MakePoint (-22562.401432422717, 6730934.887787993, 3857)
			, 27700)
			, 3857)
			--)
			as feature,
			flatstyle
			from icons`,
		spatial: true,
	},
	gpkg_spatial_ref_sys: {
		query: `
			select *
			from gpkg_spatial_ref_sys`,
		spatial: false,
	},
};

const isString = value => typeof value === 'string' || value instanceof String;

class SQLQuery {
	
	fieldTypes = {
		NULL: ['^$', '', x => null, true, 'null'],
		INTEGER: ['^([+-]?[1-9]\\d*([Ee][+-]?[1-9]\\d*)?|0)$', '', parseInt, false, '123'],
		REAL: ['^[+-]?(([1-9]\\d*(\\.\\d*)?([Ee][+-]?[1-9]\\d*)?|0)|Infinity)$', '', parseFloat, false, '123.45'],
		TEXT: ['.*', '', x => x, false, 'abc'],
		BLOB: ["^[xX]\\'(([a-f0-9A-F]){2})+\\'$", '', x => isHex(x) ? fromHexString(x).buffer : undefined, false, "x'4C696665'"],
		DATETIME: ['^[1-9]\\d{3}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$', '', x => parseDate(x), false, '2009-09-28T09:15:15'],
	};
	
	constructor(container, db, map, id) {
		this.container = isString(container) ?
			document.querySelector(container) : container;
		this.sqlQuery = document.createElement("div");
		this.rootId = id || randomVar();
		this.sqlQuery.setAttribute('id', this.rootId);
		this.container.appendChild(this.sqlQuery);
		
		this.db = db;
		this.isSpatial = false;
		this.tabCounter = 0;
		this.map = map;

		db.exec('SELECT spatialite_version();').get.first
			.then(first => {
				this.isSpatial = true;
			})
			.catch(error => {})
			.finally(x => {
				this.buildForm();
				this.setSnippets(snippets);
			});
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
		let queryTab = this.queryTab(button)
		let paramsDiv = queryTab?.querySelector('.sqlParams') || [];
		if (paramsDiv) {
			return {};
		}
		let params = {};
		let rows = paramsDiv.querySelectorAll('tr');
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
		let queryTab = this.queryTab(button);
		let query = this.getQuery(queryTab, true);
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
		for (let [name, snippet] of Object.entries(snippets)) {
			if (!snippet.spatial || this.isSpatial) {
				this.snippets[name] = snippet.query;
			}
		}
		this.buildSnippetsMenu();
	}
	
	setSnippets = (snippets) => {
		this.snippets = {};
		this.addSnippets(snippets);
	}
	
	buildSnippetsMenu = () => {
		let snippets = Object.keys(this.snippets || {})
			.map(
				name => `
					<tr>
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
		query = this.prepQuery(query);
	}
	
	getQuery(queryTab, all=false) {
		let queryElem = queryTab.querySelector('.query');
		let startPos = queryElem.selectionStart;
		let endPos = queryElem.selectionEnd;
		let selectedText = queryElem.value;
		if (!all && endPos > startPos) {
			selectedText = selectedText
				.substring(startPos, endPos);
		}
		return selectedText;
	}
	
	async runQuery(button) {
		let params = this.buildParams(button);
		let queryTab = this.queryTab(button);
		let query = this.getQuery(queryTab);
		let tabLabel = queryTab.dataset.tabLabel;
		let target = queryTab.querySelector('.sqlResults');
		
		let started = Date.now();
		let [rows, cols, error] = await this.performQuery(
			query, params, tabLabel);
		this.showTable(target, rows, cols, error, Date.now() - started);
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
	
	showTable(target, results, colnames, error, duration=0) {
		let logRows=false;
		let thead = target.querySelector('thead');
		let tbody = target.querySelector('tbody');
		let tfoot = target.querySelector('tfoot');
		thead.textContent = '';
		tbody.textContent = '';
		tfoot.textContent = '';
		if (results.length || error) {
			//let colnames = Object.keys(results[0]);
			let columns = colnames
				.map(col => `<td><div class="td">${col}</div></td>`)
				.reduce((acc, curr) => acc + curr, '');
			thead.insertAdjacentHTML(
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
						let dataPopup = false;
						let dataMime, placeHolder = 'empty';
						let minWidth = 0;
						if (typeof col === 'object') {
							if (col === null) {
								//col = '&lt;null&gt;';
								col = '';
								placeHolder = 'null';
							}
							else if (col.constructor == Uint8Array) {
								let hex = this.hexUint8(col);
								dataMime = getMimeTypeFromHex(hex);
								col = `x'${hex}'`;
								minWidth = '75vw; overflow-wrap: anywhere';
								dataPopup = true;
							}
							else if (col.constructor == ArrayBuffer) {
								let hex = this.hex(col);
								dataMime = getMimeTypeFromHex(hex);
								col = `x'${hex}'`;
								minWidth = '75vw; overflow-wrap: anywhere';
								dataPopup = true;
							}
							else {
								col = JSON.stringify(col)
									.replaceAll('\\n', '\n')
									.replaceAll('\\t', '\t');
							}
						}
						dataPopup = `data-popup="${dataPopup}"`;
						dataMime = dataMime ? `data-mime="${dataMime}"` : '';
						placeHolder = `placeholder="${placeHolder}"`;
						return `<td><div class="td data-field" ${dataPopup} ${dataMime} ${placeHolder} style="max-width: 75vw; min-width: ${minWidth}; overflow-y: auto; max-height: 12vh; overflow-y: scroll">${col}</div></td>`;
					})
					.reduce((acc, curr) => acc + curr, '');
				tbody.insertAdjacentHTML(
					'beforeend',
					`<tr>${row}</tr>`
				);
			}
			tbody.querySelectorAll('div.td[data-popup="true"]').forEach(td => {
				td.addEventListener('click', e => {this.dataPopup(e.currentTarget);});
			});
			let csvDisplay = (results.length && colnames.length) ? 'inline-block' : 'none';
			tfoot.insertAdjacentHTML(
				'beforeend',
				`<tr><td colspan="${colnames.length || 1}">
					<span style="background-color: green;">${duration} ms</span>
					<button class="csv-cp" style="display: ${csvDisplay}">csv cp</button>
					<span style="background-color: red;">${error ? error.toString() : ''}</span>
				</td></tr>`
			);
			tfoot.querySelector('button.csv-cp')
				.addEventListener('click', e => {this.csvResults(e.currentTarget);});
		}
		else {
			tbody.insertAdjacentHTML(
				'beforeend',
				`<tr><td><span style="background-color: 'green';">no results</span></td></tr>`
			);
		}
	}
	
	dataPopup(td) {
		let hex = td.textContent.slice(2, -1);
		let mime = td.dataset.mime;
		if (!hex || !mime) {
			return;
		}
		
		let countZ = 0, maxZ = -Infinity;
		walkDOM(document.body, function(node) {
			let zIndex = getStyleProperty(node, 'z-index');
			let value = parseFloat(zIndex);
			if (!isNaN(value)) {
				maxZ = Math.max(maxZ, value);
			}
			++countZ;
		}, isElement);
		maxZ = Math.max(maxZ, countZ);
		
		let overlay = this.sqlQuery.querySelector('.overlay');
		let popup = this.sqlQuery.querySelector('.popup');
		let popupcontent = popup.querySelector('.popupcontent');
		console.log(popupcontent);
		popupcontent.textContent = '';
		popupcontent.insertAdjacentHTML(
			'beforeend',
			`<div>mimetype: ${mime}</div>`
		);
		if (mime.startsWith('image/')) {
			let bytes = hexToBytes(hex);
			let base64 = bytesArrToBase64(bytes);
			let div = document.createElement('div');
			let img = document.createElement('img');
			img.setAttribute('src', `data:${mime};base64,${base64}`);
			img.crossOrigin = "anonymous";
			div.insertAdjacentElement(
				'beforeend',
				img,
			);
			popupcontent.insertAdjacentElement(
				'beforeend',
				div,
			);
		}
		overlay.style['z-index'] = maxZ + 1;
		popup.style['z-index'] = maxZ + 2;
		overlay.style.display = 'block';
		popup.style.display = 'block';
	}
	
	csvResults(button) {
		let table = button.closest('table');
		let csv = [];
		let entities = [
			table.querySelector('thead'),
			table.querySelector('tbody'),
		];
		for (let entity of entities) {
			if (!entity) {
				continue;
			}
			for (let tr of entity.querySelectorAll('tr')) {
				let fields = [];
				for (let td of tr.querySelectorAll('div.td')) {
					fields.push(td.textContent.replaceAll('\t', '&tab;'));
				}
				csv.push(fields.reduce((a, b) => a + '\t' + b));
			}
		}
		navigator.clipboard.writeText(csv.join('\n')).then(
			() => {
				//alert('clipboard successfully set');
			},
			() => {
				alert('clipboard write failed');
			},
		);
	}
	
	async mapQuery(button) {
		let params = this.buildParams(button);
		let queryTab = this.queryTab(button);
		let query = this.getQuery(queryTab);
		let tabId = queryTab.dataset.tabValue;
		let tabLabel = queryTab.dataset.tabLabel;
		
		let [rows, cols, error] = await this.performQuery(
			query, params, tabLabel);
		if (error) {
			alert(error);
			return;
		}
		if (!cols.includes('feature')) {
			alert('provide a geojson column named "feature"');
			return;
		}
		this.showLayer(tabId, tabLabel, rows);
	}
	
	showLayer(tabId, tabLabel, rows) {
		//let layer = L.Proj.geoJson(false);
		let layer = makeLayerJSON(tabLabel);
		layer.tabId = tabId;
		//retrieve with layer.feature.properties
		let dataProjection = 'EPSG:900913';
		//may set layer projection afterwards 
		for (let row of rows) {
			let {feature, crs, ...properties} = row;
			if (!['Feature', 'FeatureCollection'].includes(feature.type)) {
				feature = {
					type: 'Feature',
					properties,
					crs,
					geometry: feature,
				}
			}
			if (!crs) {
				feature.crs = {
					properties: {name: dataProjection},
					type: 'name',
				};
			}
			if (!feature.crs.type) {
				feature.crs.type = 'name';
			}
			addJSON(layer, feature);
		}
		this.map.addLayer(layer);
		show_map(this.map);
	}
	
	showLayer_(tabId, tabLabel, rows) {
		let vectorLayer = makeLayerJSON(
			tabLabel);
		let dataProjection = 'EPSG:900913';
		let featureProjection = 'EPSG:3857';
		const formatJson = new ol.format.GeoJSON();
		/*
		let vectorSource = new ol.source.Vector();
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
					feature.setStyle(style);
					feature.set('styled', true);
				}
				style = feature.getStyle();
				return style;
			},
		});
		*/
		for (let row of rows) {
			let {feature, ...properties} = row;
			if (!['Feature', 'FeatureCollection'].includes(feature.type)) {
				feature = {
					type: 'Feature',
					properties,
					geometry: feature,
				}
			}
			else {
				dataProjection = 
					(feature?.crs?.properties?.name) || dataProjection;
			}
			let features = formatJson.readFeatures(feature, {
				dataProjection: dataProjection,
				featureProjection: 'EPSG:3857',
			});
			console.log('//////', dataProjection, feature);
			features[0].setProperties(properties);
			vectorLayer.getSource().addFeatures(features);
			//vectorLayer.getSource().refresh();
			//vectorLayer.setSource(vectorLayer.getSource());
		}
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
	
	async performQuery(query, params={}, timeLabel) {
		[params, query] = this.prepKeys(params, query, timeLabel);
		if (timeLabel) {
			console.time(timeLabel);
		}
		let rows = [], cols = [], error = '';
		try {
			let rs = this.db.exec(query, params).get;
			cols = await rs.cols;
			rows = await rs.objs;
		}
		catch (exception) {
			error = exception;
		}
		if (timeLabel) {
			console.timeEnd(timeLabel);
		}
		return [rows, cols, error];
	}
	
	buildForm() {
		let html = `
			<style>
				/*
				the code for the tabbed ui comes from
				https://www.geeksforgeeks.org/how-to-create-tabs-containing-different-content-in-html/amp/
				*/
				#${this.rootId} [data-tab-info] {
					display: none;
				}
				#${this.rootId} .active[data-tab-info] {
					display: block;
				}
				#${this.rootId} .tab-content {
					margin-top: 1rem;
				}
				#${this.rootId} .tabs {
					border-bottom: 1px solid grey;
					background-color: rgb(16, 153, 9);
					color: rgb(0, 0, 0);
					margin: 0;
				}
				#${this.rootId} .tabs span {
					background: rgb(16, 153, 9);
					padding: 10px;
					border: 1px solid white;
					
					float: inline-start;
				}
				#${this.rootId} .tabs span:hover,
				#${this.rootId} .tabs span.active {
					background: rgb(55, 219, 46);
					cursor: pointer;
					color: black;
				}
				#${this.rootId} .tabs span.new-query {
					float: inline-end !important;
					background: rgb(55, 219, 46);
				}
				#${this.rootId} .tabs span.tab-close {
					padding: 0;
					margin: 0;
					border: 0;
					background: red;
					float: none;
				}
				#${this.rootId} .tab-content {
					clear: both;
				}
			</style>
				
			<style>
				#${this.rootId} div.query-container {
					width: 98vw;
					height: 60vh;
					overflow: auto;
					border: solid;
					white-space:nowrap;
				}
				#${this.rootId} div.schema li.details {
					display: block;
				}
				#${this.rootId} table.sqlResults thead,
				#${this.rootId} table.sqlResults tfoot {
					position: sticky;
				}
				#${this.rootId} table.sqlResults thead td,
				#${this.rootId} table.sqlResults tfoot td {
					opacity: 1;
					background-color: white;
				}
				#${this.rootId} table.sqlResults thead {
					inset-block-start: 0; /* "top" */
				}
				#${this.rootId} table.sqlResults tfoot {
					inset-block-end: 0; /* "bottom" */
				}
				
				#${this.rootId} .query {
					width: 100%;
					height: 100%;
					box-sizing: border-box;
					-moz-box-sizing: border-box;
				}
				#${this.rootId} .query-control {
					float: inline-start;
					margin: 0;
					padding: 1px;
				}
				#${this.rootId} .map-query {
					display: ${this.map ? 'inline-block' : 'none'};
				}
				#${this.rootId} .data-field:empty::before {
					content: attr(placeholder);
					color: gray;
				}
			</style>
				
			<style>
				/*
				the code for the popup comes from Zoie Carnegie
				https://www.loginradius.com/blog/engineering/simple-popup-tutorial/
				*/
				#${this.rootId} .overlay {
					display: none;
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					background-color: gray;
					opacity: 0.8;
					z-index: auto;
				}
				
				#${this.rootId} .popup {
					display: none;
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					background-color: green;
					/*margin-left: -250px;*/ /*Half the value of width to center div*/
					/*margin-top: -250px*/ /*Half the value of height to center div*/
					z-index: auto; /*show over leaflet*/
				}
				
				#${this.rootId} .popupcontrols {
					float: right;
					padding: 1px;
					cursor: pointer;
				}
				
				#${this.rootId} .popupcontent {
					clear: both;
					padding: 3px;
				}
				
			</style>
			<div class="tabs">
				<span class="new-query">+</span>
			</div>
			<div class="tab-content">
			</div>
			<div class="overlay"></div>
			<div class="popup">
				<div class="popupcontrols">
					<span class="popupclose">x</span>
				</div>
				<div class="popupcontent">
					<h1>Some Popup Content</h1>
				</div>
			</div>
		`;
		this.sqlQuery.textContent = '';
		this.sqlQuery.insertAdjacentHTML('beforeend', html);
		this.sqlQuery.querySelector('.popupclose')
			.addEventListener('click', e => {this.popupClose()});
		this.createTab(
			'snippets', `
			<div class="query-container">
				<table border="1"><tbody class="snippetsMenu"></tbody></table>
			</div>`
		);
		this.sqlQuery.querySelector('.new-query')
			.addEventListener('click', e => {this.addQueryTab()});
		this.schemaTree();
		this.buildSnippetsMenu();
		this.addQueryTab();
	}
	
	async schemaTree() {
		let [tab, tabInfo] = this.createTab(
			'schema', `
			<div class="query-container schema">
			</div>`,
			false);
		
		let tables = await this.db.exec(snippets.schemaTree.query).get.rows;
		let tree = gridTree(tables);
		let isGpkg = await this.db.exec(`
			SELECT count(*)
			FROM sqlite_schema
			WHERE name LIKE 'gpkg_contents'
		`).get.first;
		if (isGpkg) {
			let gpkgTables = await this.db.exec(snippets.gpkgSchema.query).get.rows;
			let gpkgTree = gridTree(gpkgTables);
			tree.push(...gpkgTree);
		}
		
		let container = tabInfo.querySelector('.query-container');
		container.insertAdjacentHTML(
			'beforeend',
			htmlTree(tree)
		);
		//console.log(JSON.stringify(tree, null, 4));
	}
	
	popupClose() {
		let popup = this.sqlQuery.querySelector('.popup');
		popup.style.display = 'none';
		popup.style['z-index'] = 'auto';
		let overlay = this.sqlQuery.querySelector('.overlay');
		overlay.style.display = 'none';
		overlay.style['z-index'] = 'auto';
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
			`<div class="tabs__tab ${_class}" data-tab-info="${_class}" data-tab-label="${label}">${content || ''}</div>`
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
			<div style="width: 98vw;">
			<div class="query-control" style="width: 70%;">
				<textarea class="query" style="white-space: nowrap; tab-size: 4; resize: none;" wrap="soft" spellcheck="false" placeholder="select 'hello';" rows="7"></textarea>
			</div>
			<div class="query-control" style="width: 28%;">
				<button class="add-param">add param</button>
				<button class="make-params">make params</button>
				<button class="pp-query">pp</button>
				<button class="log-query">log</button>
				<button class="run-query">run</button>
				<button class="map-query">map</button>
			</div>
			</div>
			<div class="query-container">
				<table border="1" class="sqlResults">
					<thead></thead>
					<tbody></tbody>
					<tfoot></tfoot>
				</table>
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

