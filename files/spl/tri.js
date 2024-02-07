
function createFunctions(db, mount) {
	console.log('createFunctions', db);
	/* unfortunately not exposed
	db.createFunction({
		name: 'twice',
		xFunc: function(pCx, arg){ // note the call arg count
			return arg + arg;
		}
	});
	*/
	db.exec(`
		SELECT StoredProc_Register(
			'sp_back_azimuth',
			'a sample Stored Procedure for testing',
			SqlProc_FromText(
				'select SqlProc_Return(
					case
					when @angle@ < 180 then @angle@ + 180
					else @angle@ - 180
					end
				)'
			)
		);
	`);
	return db;
}

window.onDbInit = createFunctions;

window.extraSnippets = {
	spExecTest: {
		query: `
		SELECT StoredProc_Execute (
			'sp_back_azimuth',
			:angle
		)
		`,
		params: {
			'+angle': 71.5
		},
		spatial: true,
	},
	triangulationTest: {
		query: `
			with
			input as (
				select
				makepoint(
					34.79775
					,
					31.95956
					,
					4326) as a,
				makepoint(
					34.80344
					,
					31.96096
					,
					4326) as b,
				71 as ab,
				makepoint(
					34.79896
					,
					31.96676
					,
					4326) as c,
				4 as ac
			),
			reverse as (
				select
					radians(
						case
							when 180 > ab then 180 + ab
							else ab - 180
						end
					) as ba,
					radians(
						case
							when 180 > ac then 180 + ac
							else ac - 180
						end
					) as ca,
					*
				from input
			),
			projects as (
				select 
					makeline(b, project(b, 100000, ba)) as baover,
					makeline(c, project(c, 100000, ca)) as caover,
					*
				from reverse
			),
			result as (
				select
					intersection(baover, caover) as x,
					*
				from projects
			)
			select
				b as feature,
				'b' as name,
				json('{radius: 5, weight: 1, opacity: 1, fillOpacity: 0}') as style
			from input
			union all
			select
				c as feature,
				'c' as name,
				json('{radius: 5, weight: 1, opacity: 1, fillOpacity: 0}') as style
			from input
			union all
			select
				a as feature,
				'a' as name,
				json('{color: "red", radius: 5, weight: 1, opacity: 1, fillOpacity: 0}') as style
			from input
			union all
			select
				x as feature,
				'x' as name,
				json('{color: "green", radius: 5, weight: 1, opacity: 1, fillOpacity: 0}') as style
			from result
			`,
		spatial: true,
	}
};
