
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
		createPoly: `WITH t1(x,y,n,color) AS (VALUES
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
SELECT
   geopoly_json(
geopoly_regular(x,y,40,n))
   FROM t1;`
	};
	
	constructor(selector, db, thisName, snippets) {
		this.sqlQuerySelector = selector;
		this.db = db;
		this.thisName = thisName;
		if (snippets) {
			this.snippets = snippets;
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
	
	runQuery(query) {
		let params = this.buildParams();
		let queryElem = document.querySelector(`${this.sqlQuerySelector} .query`);
		
		this.sql(query || queryElem.value, params);
	}
	
	showResults(results, colnames, logRows=false) {
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
				row = row//colnames
					//.map(col => `<td>${row[col]}</td>`)
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
	
	delParam(_this) {
		let tr = _this.closest('tr');
		let ok = confirm(`delete ${tr.querySelector('.variable').value} ?`);
		if (ok) {
			tr.parentNode.removeChild(tr);
		}
	}
	
	async sql(query, params={}) {
		let cols = await this.db.exec(
			//query
		//{
			//sql: 
			query,
			//bind: 
			prepKeys(
				params,
				query),
		//}
		).get.cols;
		let rows = await this.db.exec(
			//query
		//{
			//sql: 
			query,
			//bind: 
			prepKeys(
				params,
				query),
		//}
		).get.rows;
		this.showResults(rows, cols);
	}
	
	buildForm() {
		let html = `
			<table border="0"><tbody class="sqlParams"></tbody></table>
			<div>
				<button onclick="${this.thisName}.addParam()">add param</button>
				<button onclick="${this.thisName}.makeParams()">make params</button>
				<button onclick="${this.thisName}.runQuery()">run</button>
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
