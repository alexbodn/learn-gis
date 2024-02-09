
'use strict';

//todo
//copy results as json array of objects
//eventually zipped
//map show wkt and geojson from query textarea

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
		let summary = node.summary
		.replace(
			/\[\s*(.*?)\s*\]/gm,
			(match, match1) => {
				let [tag, title, ...action] = match1.split('\t');
				return `<${tag} data-action="${action.join('\t')}">${title}</${tag}>`;
			}
		);
		return node.details ? `
			<li class="details">
			<details>
				<summary>${summary}</summary>
				${htmlTree(node.details)}
			</details>
			</li>` :
			`<li class="leaf">${summary}</li>`;
	}
	return `<ul>${tree.map(htmlNode).join('\n')}</ul>`;
}

const pinBase64 = `
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
	`;

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
	geometryTypes: {
		query: `
			with geometry_types(name, number) as
			(VALUES
				('GEOMETRY', 0),
				('POINT', 1),
				('LINESTRING', 2),
				('POLYGON', 3),
				('MULTIPOINT', 4),
				('MULTILINESTRING', 5),
				('MULTIPOLYGON', 6),
				('GEOMETRYCOLLECTION', 7),
				('CIRCULARSTRING', 8),
				('COMPOUNDCURVE', 9),
				('CURVEPOLYGON', 10),
				('MULTICURVE', 11),
				('MULTISURFACE',  12),
				('CURVE', 13),
				('SURFACE', 14),
				('POLYHEDRALSURFACE', 15),
				('TIN', 16),
				('TRIANGLE', 17)
			)
			select *
			from geometry_types`,
		spatial: false,
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
					'icon-src', 'data:'||'image/png;base64,${pinBase64}'
					
					--'circle-stroke-color', 'blue',
					--'circle-stroke-width', 1,
					--'circle-radius', 5
				) as flatstyle,
				json_object(
					--'text-value', '',
					'icon-color', '#8959A8',
					'icon-cross-origin', 'anonymous',
					'iconUrl', 'data:'||'image/png;base64,${pinBase64}'
					
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

let conditionalSchema = {
	gpkg_contents: `
SELECT 
'gpkg' as gpkg,
data_type,
gpkg_contents.table_name ||
case
	when data_type='attributes'
	then ''
	else ' [button\tmap\tmapTable\t' ||
	data_type || '\t' ||
	gpkg_contents.table_name ||
	case
		when data_type='tiles'
		then ''
		else '\t' || column_name
	end || ']'
end,
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
order by data_type, gpkg_contents.table_name, column`,
	geometry_columns: `
with
	geometry_types as (
		${snippets.geometryTypes.query}
	)
select 'spatialite', 'geometries', 'tables',
f_table_name ||
	' [button\tmap\tmapTable\tfeatures\t' ||
	f_table_name || '\t' ||
	f_geometry_column || ']'
	as [table],
f_geometry_column || ' ' ||
coalesce(
	geometry_types.name,
	cast (geometry_type as TEXT)
) as column
from geometry_columns
left outer join geometry_types
	on geometry_types.number=geometry_type
`,
	views_geometry_columns: `
select 'spatialite', 'geometries', 'views',
view_name as [view],
view_geometry as geometry
from views_geometry_columns`,
	virts_geometry_columns: `
select 'spatialite', 'geometries', 'virts',
virt_name as virt,
virt_geometry as geometry
from virts_geometry_columns`,
	networks: `
select 'spatialite', 'networks',
network_name,
null, null
from networks`,
	topologies: `
select 'spatialite', 'topologies',
topology_name,
null, null
from topologies`,
	raster_coverages: `
select 'spatialite', 'raster_coverages',
coverage_name,
null, null
from raster_coverages`,
	vector_coverages: `
select 'spatialite', 'vector_coverages',
coverage_name,
null, null
from vector_coverages`,
	stored_procedures: `
select 'spatialite', 'stored_procedures',
name,
null, null
from stored_procedures`,
	stored_variables: `
select 'spatialite', 'stored_variables',
name,
null, null
from stored_variables`,
};

const isInteger = value => Number.isInteger(value);
function isFloat(n){
	return Number(n) === n && n % 1 !== 0;
}
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
	
	constructor(container, db, {id, build_map}={}) {
		this.container = isString(container) ?
			document.querySelector(container) : container;
		this.sqlQuery = document.createElement("div");
		this.rootId = id || randomVar();
		this.sqlQuery.setAttribute('id', this.rootId);
		this.sqlQuery.style.height = '100%';
		this.sqlQuery.style.width = '100%';
		this.container.appendChild(this.sqlQuery);
		
		this.db = db;
		
		this.isSpatial = false;
		this.isGpkg = undefined;
		this.db.exec(`
			SELECT count(*) as isGpkg
			FROM sqlite_schema
			WHERE name LIKE 'gpkg_contents'
		`).get.first
		.then(isGpkg => {
			this.isGpkg = isGpkg;
			if (isGpkg && window.proj4) {
				this.db.exec(`
					SELECT
						organization||':'||cast(organization_coordsys_id as text) as srs,
						definition
					FROM gpkg_spatial_ref_sys
					WHERE
						srs_id>0
						--AND srs_id NOT IN (4326, 3857)
					;
				`).get.rows
				.then(projections => {
					//todo run this with each loaded geojson
					proj4.defs(projections);
				})
				.catch(error => {
					console.log('error loading projections', error);
				});
			}
		});
		this.has_layer_styles = undefined;
		this.db.exec(`
			SELECT count(*)
			FROM sqlite_schema
			WHERE name like 'layer_styles'
		`).get.first
		.then(has_layer_styles => {
			this.has_layer_styles = has_layer_styles;
		});
		this.withMap = !!build_map;
		this.build_map = build_map;
		this.layersOnMap = {};
		
		this.tabCounter = 0;
		this.tabEvents = {};
		
		this.waitingSnippets = {};
		
		this.buildForm();
		
		db.exec(`SELECT spatialite_version();`).get.first
			.then(first => {
				this.isSpatial = true;
			})
			.catch(error => {})
			.finally(x => {
				this.setSnippets(snippets);
				this.addSnippets(this.waitingSnippets, true);
				//this.setSchema();
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
	
	addParam(button, name='', value, type) {
		function typeOptions(fieldTypes, choice='NULL') {
			return Object.keys(fieldTypes)
				.map(oneType => `<option value="${oneType}" ${oneType == choice ? 'selected="selected"' : ''}>${oneType}</option>`)
				.reduce((a, b) => (a + '\n' + b), '')
				;
		}
		if (typeof type === 'undefined') {
			let detect = this.dataStringify(value);
			[value, type] = detect;
		}
		let longForm = name.startsWith('+');
		if (longForm) {
			name = name.slice(1);
		}
		let row = `
			<tr>
				<td style="width: 29%">
					<input class="variable" type="text" value="${name}" placeholder="name" style="width: 100%" />
				</td>
				<td style="width: 29%">
					<select class="type" style="width: 100%">
						${typeOptions(this.fieldTypes, type)}
					</select>
				</td>
				<td style="width: 29%">
					<input class="value" pattern="/^$/" disabled="disabled" value="${value || ''}" placeholder="null" style="width: 100%" />
				</td>
				<td style="width: 3%"><input type="checkbox" class="long-form" style="width: 100%" /></td>
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
		newVar.querySelector('input.long-form').checked = longForm;
		newVar.querySelector('button.del-param').addEventListener('click', e => {this.delParam(e.currentTarget);});
		newVar.querySelector('input.variable').focus();
	}
	
	buildParams(button, testValues=true) {
		let queryTab = this.queryTab(button)
		let paramsDiv = queryTab?.querySelector('.sqlParams');
		if (!paramsDiv) {
			return {};
		}
		let params = {};
		let rows = paramsDiv.querySelectorAll('tr');
		const nameRegex = /^[a-z_A-Z][a-z_A-Z0-9]*$/;
		rows.forEach(curr => {
			let varField = curr.querySelector('.variable');
			let variable = varField.value;
			let type = curr.querySelector('.type').value;
			let longForm = curr.querySelector('.long-form').checked;
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
			if (longForm) {
				value = `@${variable}@=${value}`
			}
			else {
				value = fmt(value);
			}
			params[variable] = value;
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
	
	createMainMenu() {
		this.createTab(
			'☰', `
			<div class="query-container">
				<table border="1"><tbody class="mainMenu"></tbody></table>
			</div>`
		);
	}
	
	createSnippetsTab() {
		this.createTab(
			'snippets', `
			<div class="query-container">
				<table border="1"><tbody class="snippetsMenu"></tbody></table>
			</div>`
		);
		this.buildSnippetsMenu();
	}
	
	addSnippets = (snippets, deleting=false) => {
		if ('snippets' in this) {
			for (let [name, snippet] of Object.entries(snippets)) {
				if (!snippet.spatial || this.isSpatial) {
					this.snippets[name] = snippet;
					if (deleting) {
						delete snippets[name];
					}
				}
			}
			this.buildSnippetsMenu();
		}
		else {
			for (let [name, snippet] of Object.entries(snippets)) {
				this.waitingSnippets[name] = snippet;
			}
		}
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
		let {query} = this.snippets[snippet];
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
	
	cpSnippet(snippet, currentTarget) {
		snippet = this.currentSnippet(snippet, currentTarget);
		let {query} = this.snippets[snippet];
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
	
	openSnippet(snippet, currentTarget) {
		snippet = this.currentSnippet(snippet, currentTarget);
		let {query, params} = this.snippets[snippet];
		query = this.unindent(query);
		this.addQueryTab(snippet, query, params);
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
		
		let started = Date.now();
		let [rows, cols, error] = await this.performQuery(
			query, params, tabLabel);
		this.showTable(queryTab, rows, cols, error, Date.now() - started);
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
	
	dataStringify(data) {
		let str, type;
		if (typeof data === 'object') {
			if (data === null) {
				str = '';
				type = 'NULL';
			}
			else if (data.constructor == Uint8Array) {
				let hex = this.hexUint8(data);
				str = `x'${hex}'`;
				type = 'BLOB';
			}
			else if (data.constructor == ArrayBuffer) {
				let hex = this.hex(data);
				str = `x'${hex}'`;
				type = 'BLOB';
			}
			else {
				str = JSON.stringify(data)
					.replaceAll('\\n', '\n')
					.replaceAll('\\t', '\t');
				type = 'TEXT';
			}
		}
		else if (isString(data)) {
			str = data;
			type = 'TEXT';
		}
		else if (isInteger(data)) {
			str = data.toString();
			type = 'INTEGER';
		}
		else if (isFloat(data)) {
			str = data.toString();
			type = 'REAL';
		}
		else {
			[str, type] = ['', 'NULL'];
		}
		return [str, type];
	}
	
	showTable(queryTab, rows, colnames, error, duration=0) {
		let logRows=false;
		
		let tabRect = queryTab
			.getBoundingClientRect();
		let resultsDiv = queryTab
			.querySelector('.results-container');
		resultsDiv.style.height = (
			tabRect.height +
			tabRect.y -
			resultsDiv.getBoundingClientRect().y
		).toString() + 'px';
		
		let target = queryTab.querySelector('.sqlResults');
		let thead = target.querySelector('thead');
		let tbody = target.querySelector('tbody');
		let tfoot = target.querySelector('tfoot');
		thead.textContent = '';
		tbody.textContent = '';
		tfoot.textContent = '';
		if (rows.length || error) {
			//let colnames = Object.keys(rows[0]);
			let columns = colnames
				.map(col => `<td><div class="td">${col}</div></td>`)
				.reduce((acc, curr) => acc + curr, '');
			thead.insertAdjacentHTML(
				'beforeend',
				`<tr>${columns}</tr>`
			);
			for(let row of rows) {
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
			tbody.querySelectorAll('div.td[data-popup="true"]').forEach(tdDiv => {
				tdDiv.addEventListener('click', e => {this.dataPopup(e.currentTarget.parentNode);});
			});
			let csvDisplay = (rows.length && colnames.length) ? 'inline-block' : 'none';
			tfoot.insertAdjacentHTML(
				'beforeend',
				`<tr><td colspan="${colnames.length}">
					<span style="background-color: blue;">${rows?.length || 0} rows</span>
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
		let tdDiv = td.querySelector('div.td');
		let hex = tdDiv.textContent.slice(2, -1);
		let mime = tdDiv.dataset.mime;
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
		let tabId = queryTab.dataset.tabInfo;
		let tabLabel = queryTab.dataset.tabLabel;
		if (tabId in this.layersOnMap) {
			this.removeLayer(tabId);
		}
		else {
			await this.featuresLayer(
				tabLabel, tabId, undefined, query, params);
		}
	}
	
	async tilesLayer(layerLabel, layerId, table_name) {
		
		function get_lat_lng_for_number(xtile, ytile, zoom) {
			let n = Math.pow(2.0, Math.round(zoom));
			let lng = xtile / n * 360.0 - 180.0;
			let lat_rad = Math.atan(Math.sinh(Math.PI * (1.0 - 2.0 * ytile / n)));
			let lat = 180.0 * lat_rad / Math.PI;
			return {lat, lng};
		}
		
		let tableInfo = {};
		await this.db.exec(`
			select *
			from (
				select zoom_level,
					min(tile_column) as first_col,
					max(tile_row) + 1 as first_row,
					min(tile_row) as last_row,
					max(tile_column) + 1 as last_col,
					count(*) as ntiles
				from ${table_name}
				group by zoom_level
			) as group_tiles
			order by ntiles desc
			limit 1
		`, [table_name]).get.objs
		.then(objs => {
			if (!objs.length) {
				return;
			}
			let rec = objs[0];
			tableInfo.bounds = [
				get_lat_lng_for_number(rec.first_col, rec.first_row, rec.zoom_level),
				get_lat_lng_for_number(rec.last_col, rec.last_row, rec.zoom_level),
			];
			tableInfo.zoom_level = rec.zoom_level;
		});
		
		tableInfo.fetchTile = (x, y, z) => {
			return this.db.exec(`
				select 
				--casttoblob(
					tile_data
				--)
				from ${table_name}
				where zoom_level=${z} and tile_column=${x} and tile_row=${y}
			`).get.first
			.then(tile_data => {
				//const buff = new Uint8Array(tile_data);
				//let mime = getMimeTypeFromUint8Array(buff);
				let blob = new Blob(
					[tile_data],
					//{type: mime},
				);
				return URL.createObjectURL(blob);
			});
		};
		
		await this.db.exec(`
			select zoom_level, tile_width, tile_height
			from gpkg_tile_matrix
			where table_name=?
		`, [table_name]).get.objs
		.then(objs => {
			tableInfo.imgSizes = objs
			.reduce((acc, level) => {
				acc[level.zoom_level] = {
					width: level.tile_width,
					height: level.tile_height,
				};
				return acc;
			}, {});
		});
		
		let layer = this.map.makeTiledLayer(
			layerLabel, layerId, tableInfo);
		this.map.addLayer(layer);
		this.layersOnMap[layerId] = layerLabel;
		
		this.showMap();
	}
	
	async featuresLayer(layerLabel, layerId, sldStyle, query, params={}) {
		let [rows, cols, error] = await this.performQuery(
			query, params, layerLabel);
		if (error) {
			alert(error);
			return;
		}
		if (!cols.includes('feature')) {
			alert('provide a geojson column named "feature"');
			return;
		}
		let extent;
		if (rows.length) {
			let geometry;
			for (let row of rows) {
				if (row.feature) {
					if (row.feature.coordinates) {
						geometry = 'feature';
					}
					else if (row.feature.geometry?.coordinates) {
						geometry = "json_extract(feature, '$.geometry')";
					}
					break;
				}
			}
			if (geometry) {
				let [rowsExtent, cols1, errorExtent] = await this.performQuery(`
					SELECT extent(geomfromgeojson(${geometry})) as extent
					FROM (
						${query}
					)
					WHERE feature is not null
				`, params);
				if (errorExtent) {
					error += ' ' + errorExtent;
				}
				else {
					extent = rowsExtent[0].extent;
				}
			}
		}
		
		if (extent) {
			extent = extent.coordinates[0];
		}
		this.showLayer(
			layerId, layerLabel, rows, extent, {sldStyle});
	}
	
	showLayer(tabId, tabLabel, rows, extent, {sldStyle}={}) {
		let layer = this.map.makeLayerJSON(
			tabLabel, tabId, {extent, sldStyle});
		let dataProjection = 'EPSG:900913';
		//may set layer projection afterwards 
		for (let row of rows) {
			let {feature, ...properties} = row;
			if (!feature) {
				continue;
			}
			let {crs, ...rest} = feature
			feature = rest;
			if (!['Feature', 'FeatureCollection'].includes(feature.type || '')) {
				feature = {
					type: 'Feature',
					properties,
					geometry: feature,
				}
			}
			if (!crs) {
				crs = {
					properties: {name: dataProjection},
					type: 'name',
				};
			}
			else {
				let code = crs.properties[crs.type || 'name'] || '';
				if (code.endsWith('EPSG:4326')) {
					crs = null;
				}
			}
			if (crs) {
				if (!crs.type) {
					crs.type = 'name';
				}
				feature.crs = crs;
			}
			this.map.addJSON(layer, feature);
		}
		this.map.addLayer(layer);
		this.layersOnMap[tabId] = tabLabel;
		this.showMap();
	}
	
	removeLayer(layerId) {
		if (layerId in this.layersOnMap) {
			this.map.remove_layer(layerId);
			delete this.layersOnMap[layerId];
			this.showMap();
		}
	}
	
	showMap() {
		let map_tab = this.tabFetch(this.map_tab);
		if (map_tab) {
			this.tabActivate(map_tab);
			this.map.show_map();
		}
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
			let replaced = this.snippets[snippet].query;
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
		query = query.replace('&tab;', '\t');
		return query.replace(snippetRe, replacer);
	}
	
	prepKeys(obj, query, label) {
		let params = obj;
		let error;
		query = this.prepQuery(query, true);
		if (!query) {
			error = 'the query is empty';
		}
		if (error || Array.isArray(obj)) {
			return [params, query, error];
		}
		const paramRe = /:[a-z_A-Z][a-z_A-Z0-9]*/g;
		if (typeof(obj) == 'object') {
			params = {};
			let paramRe = /:([a-z_A-Z][a-z_A-Z0-9]*)/g;
			let param;
			while (param = paramRe.exec(query)) {
				let val = obj[param[1]];
				if (typeof(val) == 'undefined') {
					error = `parameter ${param[1]} not defined for ${label}.`;
					break;
				}
				params[param[0]] = val;
			}
		}
		return [params, query, error];
	}
	
	async performQuery(query, params={}, timeLabel) {
		let rows = [], cols = [], error = '';
		if (!error) {
			[params, query, error] = this.prepKeys(params, query, timeLabel);
			if (timeLabel) {
				console.time(timeLabel);
			}
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
		}
		return [rows, cols, error];
	}
	
	buildForm() {
		let html = `
			<style>
				#${this.rootId} {
					width: 100%;
					height: 100%;
				}
			</style>
			<style>
				/*
				the code for the tabbed ui comes from
				https://www.geeksforgeeks.org/how-to-create-tabs-containing-different-content-in-html/amp/
				*/
				#${this.rootId} [data-tab-info] {
					display: none;
					width: 100%;
					height: 100%;
				}
				#${this.rootId} .active[data-tab-info] {
					display: block;
				}
				#${this.rootId} .tab-content {
					margin-top: 1rem;
					width: 100%;
					height: 100%;
				}
				#${this.rootId} .tabs {
					border-bottom: 1px solid grey;
					background-color: rgb(16, 153, 9);
					color: rgb(0, 0, 0);
					margin: 0;
				}
				#${this.rootId} .tabs span {
					background: rgb(16, 153, 9);
					max-height: 2.5em;
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
				
				#${this.rootId} .query-container .map-container {
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					position: relative;
					border: solid 1px gray;
				}
			</style>
				
			<style>
				#${this.rootId} div.query-container {
					width: 100%;
					height: 100%;
					border: solid 1px red;
					overflow: auto;
					white-space: nowrap;
				}
				#${this.rootId} .clear {
					clear: both;
				}
				#${this.rootId} div.results-container {
					width: 100%;
					border: solid 1px red;
					overflow: auto;
					position: relative;
				}
				
				#${this.rootId} div.schema li.details {
					display: block;
				}
				#${this.rootId} table.sqlResults {
					height: 100%;
					width: 100%;
				}
				#${this.rootId} .sqlParams td * {
					box-sizing: border-box;
					-moz-box-sizing: border-box;
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
					display: ${this.withMap ? 'inline-block' : 'none'};
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
			<div class="tab-content clear">
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
		this.createMainMenu();
		this.createMapTab();
		this.createSnippetsTab();
		this.sqlQuery.querySelector('.new-query')
			.addEventListener('click', e => {this.addQueryTab()});
		this.schemaTree();
		this.addQueryTab();
		
		//lastly
		this.showMap();
	}
	
	schemaTree = () => {
		this.createTab(
			'schema', `
			<div class="query-container schema">
			</div>`,
			{
				events: {
					click: this.setSchema
				}
			}
		);
	}
	
	async buildConditionalSchema() {
		return this.db.exec(`
			SELECT json_group_object(name, type)
			FROM sqlite_schema
			WHERE type IN ('table', 'view')
		`).get.first
		.then(entities => {
			let available = Object.entries(conditionalSchema)
				.filter(entry => {
					let [entity, query] = entry;
					return entity in entities;
				})
				.map(entry => {
					let [entity, query] = entry;
					return this.db.exec(query).get.rows;
				});
			return Promise.allSettled(available);
		});
	}
	
	async mapTable(data_type, table_name, column_name) {
		if (table_name in this.layersOnMap) {
			this.removeLayer(table_name);
		}
		else {
			if (data_type == 'features') {
				let columns = await this.db.exec(`
					SELECT name
					FROM pragma_table_info('${table_name}')
					WHERE name not in ('${column_name}')
				`).get.flat;
				columns.push(`asgeojson(
					GeomFromGPB([${column_name}]), 15, 2) as feature`);
				let query = `
					select ${columns.join(', ')}
					from [${table_name}]`;
				let sldStyle;
				if (this.has_layer_styles) {
					sldStyle = await this.db.exec(`
						SELECT styleSLD as sldStyle
						FROM layer_styles
						where f_table_name='${table_name}'
					`).get.first;
				}
				await this.featuresLayer(table_name, table_name, sldStyle, query);
			}
			else {
				await this.tilesLayer(table_name, table_name, table_name);
			}
		}
	}
	
	async setSchema(tab) {
		let tables = this.db.exec(
			snippets.schemaTree.query
		).get.rows;
		Promise.all([
			Promise.allSettled([tables]),
			this.buildConditionalSchema()
		])
		.then(groups => {
			let tree = [];
			for (let group of groups) {
				for (let table of group) {
					if (table.status == "fulfilled") {
						let subTree = gridTree(table.value);
						if (subTree) {
							tree.push(...subTree);
						}
					}
					else {
						console.log(table);
					}
				}
			}
			let html = htmlTree(tree);
			
			if (!tab) {
				tab = this.sqlQuery;
			}
			let target = tab.querySelector('.query-container.schema');
			target.textContent = '';
			target.insertAdjacentHTML(
				'beforeend', html);
			target.querySelectorAll('[data-action]')
			.forEach(
				tag => {
					let [method, ...params] = tag.dataset.action.split('\t');
					tag.addEventListener('click', e => {this[method].call(this, ...params);});
					if (method === 'mapTable') {
						if (params[1] in this.layersOnMap) {
							tag.textContent = 'unmap';
						}
					}
				}
			);
		});
	}
	
	createMapTab() {
		if (!this.withMap) {
			return;
		}
		let [tab, tabInfo] = this.createTab(
			'map', `
			<div class="query-container">
				<div class="map-container">
				</div>
			</div>`,
		);
		this.tabClick(tab);
		let map_container = tabInfo.querySelector(
			'.query-container .map-container'
		);
		
		this.map = new this.build_map(map_container);
		this.map_tab = tab.dataset.tabValue;
	}
	
	getMap() {
		return this.map;
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
		const tabInfo = this.sqlQuery
			.querySelector(tab.dataset.tabValue);
		const tabInfos = this.sqlQuery
			.querySelectorAll('[data-tab-info]');
		tabInfos.forEach(tabInfo => {
			tabInfo.classList.remove('active')
		});
		if (tab && tabInfo) {
			tab.classList.add('active');
			tabInfo.classList.add('active');
		}
		let _class = tabInfo.dataset.tabInfo;
		if ('click' in this.tabEvents[_class]) {
			this.tabEvents[_class].click.call(this, tabInfo);
		}
	}
	
	tabOnClick = tab => {
		tab.addEventListener('click', e => {this.tabClick(tab)});
	}
	
	tabActivate = tab => {
		if (!(tab.classList.contains('active'))) {
			this.tabClick(tab);
		}
	}
	
	createTab(label, content, {
		withClose=false,
		events={},
	}={}) {
		let _class = `tab_${++this.tabCounter}`;
		this.tabEvents[_class] = events;
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
		this.tabsSyncHeight();
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
		let tabInfo = tabInfos.querySelector(
			`div[data-tab-info="${_class}"]`
		);
		this.tabOnClick(tab);
		return [tab, tabInfo];
	}
	
	queryOnClick(tab) {
		let mapButton = tab.querySelector('.map-query');
		let prefix = '';
		if (tab.dataset.tabInfo in this.layersOnMap) {
			prefix = 'un';
		}
		mapButton.textContent = prefix + 'map';
	}
	
	addQueryTab = (label, query='', params={}) => {
		let html = `
			<div class="query-with-controls" style="width: 100%;">
				<table border="0"><tbody class="sqlParams"></tbody></table>
				<div class="query-controls" style="width: 100%;">
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
						<button onclick="window.open('https://github.com/jvail/spl.js', '_BLANK', '', '');">spl.js</button>
					</div>
					<div class="clear" />
				</div>
			</div>
			<div class="results-container">
				<table border="1" class="sqlResults">
					<thead></thead>
					<tbody></tbody>
					<tfoot></tfoot>
				</table>
			</div>
			`;
		let [tab, tabInfo] = this.createTab(label, html, {
			withClose: true,
			events: {
				click: this.queryOnClick,
			}
		});
		tabInfo.querySelector('.query').value = query;
		let addParam = tabInfo.querySelector('button.add-param');
		for (let [name, value] of Object.entries(params)) {
			this.addParam(addParam, name, value);
		}
		addParam.addEventListener('click', e => {this.addParam(e.currentTarget);});
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
			tab_1 = this.tabFetch('.tab_1');
		}
		tab.remove();
		target.remove();
		this.tabsSyncHeight();
		if (tab_1) {
			this.tabClick(tab_1);
		}
	}
	
	tabsSyncHeight() {
		let tabs = this.sqlQuery.querySelector('.tabs');
		let tabInfos = this.sqlQuery.querySelector('.tab-content');
		let sqlQueryRect = this.sqlQuery.getBoundingClientRect();
		tabInfos.style.height = (sqlQueryRect.height + sqlQueryRect.y - tabInfos.getBoundingClientRect().y).toString() + 'px';
	}
	
	tabFetch(tabValue) {
		return this.sqlQuery.querySelector(
			`span[data-tab-value="${tabValue}"]`);
	}
};

