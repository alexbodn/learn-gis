
const stlouis_remote = 'https://github.com/ngageoint/geopackage-js/raw/master/docs/examples/GeoPackageToGo/StLouis.gpkg';
const stlouis_local = new URL('./test/files/dbs/stlouis.gpkg', window.location.href).toString();
const stlouis_view = [[38.6258, -90.189933], 14];
let pizzaPng = `data:image/png;base64,
	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
	SUVORK5CYII=
	`;
let poiPng = `data:image/png;base64,
	iVBORw0KGgoAAAANSUhEUgAAACAAAAAqCAYAAADS4VmSAAAABGdBTUEAALGPC/xhBQAABTNJREFU
	WAm1V2tMHFUUPnd22cWCrg1QBCmvVEC01T5V0gc11WgTSIiiNU3xkUj9YxurBh9BN9DGVBOTqjFa
	JamxTROJELc1attU8NE0Uk3qgxRsoawFIUCFAi0Lu1zPmeWuM7MzO3drucnk3vudc77vzNznMJAs
	t1V6XRNTM+v5DC8H4MXAWCYHyKRwBtAHnPdhq50pzJfkUr79o9E7JUONsbFLbqX3Jh4IvgacbebA
	b4jtHbYyYJeA8QPM7aw73+jtjxVjmcCiZ99xT/cMvcr5zA4kSIpFEsM2wZjydkJO6q6z724LmPmZ
	JjD71s2cw91mQfFijMFJ/BoVZl8jKoG8cu+SEIS+xDHNilcopj9jF5wMNnZ9Uf+b1k+XAL35TCDU
	ds3FhSImobgdK7VfQhE2GnOcbM3xiM9LdMHt+RmCwr7Gr0oapCWcIwmEJ1x8Y161cRXUPH6/4JKq
	aV6RlnBWE1AnXXi2C9y2TnQlQHXFali7dBEsLYxvutDKIk0SURNQ13mcS20Lvn2KJ7w6t29ab5uw
	wSFpVhMY7XDjk6FB2U2GiNwuJ/z40fOQNj85wlu24wP49WxvpG/XoM0qOdGRpqjbq+QOJ0g3P7BS
	J0749k2lwixV0wuTtjO8t5vHJDgdkJ0+H3IzUyAPn/ybUyE3I8V0zDesKoLmN6uhu28In2H1OU/1
	38MwccX8WCBtp3qwmOi7UPwTbxWULMk3sZpDy4oWAj3aMnBxDB6q2Qt/DYxo4dk2L1boVDOxwFQw
	BE/W7YcfTp8zM0th/cOX4NFXGizEkQK1FXGkmjFOTk3DU5hEy89/mpljYr2DI1D50sfqUFg5krbC
	cOuzciA8MB2Ep3cdgGM/nYnlprP5+y+q4v6Bf3S4sUPaCp7ztmuHhmPrGwfh5O/dRo6o/sjYZah8
	uQF6B0ejbFEAatMQSH3fYGgGxiYmoziMAK0cGnuZwhl0KniF+kbGmXwKc9JtXZOuc0PWghtt/ciB
	MXZE4U7lKxlv2vsX4p4gU2QSJR7SVvyfe7vwxnLCjviW7DTKOOJGs/yFPU3qMmtr74ng1CjIXqDr
	m3VIk7RxI8ITibM9IeAlZo4CE281NDIO733WCvu/boNpnJxUHsbldu+KAnhxywYozsuQSoA0KVZN
	IGe5o6nrl9CFWJeRzFQPvPXpMWjwnYArgWmK1ZXjpzqBnrI1i+HBe4p1tqgO3oxyljmaug+pV/qw
	Obu8thoT+DDKeS4Axrb6ffV7iTpyI7rLvbgBx7h9LvS0nKRBWgKLJNDY+EiIc14jDHNVkwZpCf5I
	AgT4D+08jBkeFsZrXRM3aWh5dQmQwe12P4NLRGIf1dLYt4mTuI2eDiMw3H58zFNYOozbRJnR9r/6
	TNnW1fx6i5Hjv53FYMFVcQRXxX0G+Oq6jB3FWW96f48aAqGAfzBV+NkGRP9qa+IgLqt4ywTo90lR
	nBQY875gRTyLc+LQ/ooZ/aPmgNZh5EzLOU/hukTEVmtx+Tbb3eOrUzccqxjLLyAC8pc7anGitIi+
	bE0xFGvnbzkJtYEFj3lTA+PBUzgWOVrcqo2kPe5k54rOg94hKx+BSyVAznkVtXeEgnRs83ki2Lxm
	lx1OKOlurj9tbtejtkMg3FVCxp4QfcsafWTFiSPmJDSKjHa0tnuK1hJcarSpfQZeXO/vm9oswLgS
	II7Rju9aPbeuy8XFeaeOU2H7/L6dz+kwiY70EGi50tKzqvF+djSCYVvFIoB8Q3oSGikLy3dfP8nH
	vyc8kSWv6fDVjBl9ZPr/ArMCymZX4MxBAAAAAElFTkSuQmCC
	`;
let shadowPng = `data:image/png;base64,
	iVBORw0KGgoAAAANSUhEUgAAACAAAAAmCAYAAAClI5npAAAABGdBTUEAALGPC/xhBQAAA8RJREFU
	WAmd1omW1EYMhWFISAJkef/nJCFkn+gz/TvV7nbPBJ0jJJeWe6Wye3j96svk9UnZ08n56fFZo2NB
	eWc24DN77Lc/v9m9cwco/eqSwuZHKOB/JkZJttjn08O/NTgcb48BB/71nAJebfVA/h4FerRi6bjX
	craBwAHKAcp+c7GdHQn8NXH658Ui4/l0G/cIBC6GwLeLfnfxI9JVAAj4j/F/H2UpKc6/upIjgRXc
	1MCBvlt0JbFuwNSBfxqfIignIkiSncRKIPDuGPjb0fejP4x+f/ERcK5WLmnVv41vejm2FIFxt3P5
	cslGYiXgEIkmb+of5+ynUSSQAQ5A7boB0wFHAvk1Lg+gTbiOmw00PcYRAGJqwCsBxDRfATREALnA
	9QKWipueRuBJkwQJRRpQQBGwBT7tBUR03UDXoGerD5T1jpSzbyECgXvW2PTWHWi21a8gk7ZNpA4w
	Taw88L4MtRHYNtD6I2HC1ErXO3cOaJ1+HrdNtA3WpMiqBVw/1vOO2QbmbDusedfAalKD4oGpS5yJ
	E/lIqPU51u+mfl1XviTENGErqvk98EnbpNhac+wlMazdUbiqBM9sOu52xj6SSFS39loxtjzBo9Qg
	K95nc8x99LzW1Cu710VAcm8m6/6y3uIvlT7Deq0YG8EIAIhxyRU757PpuHel+FrTt99QCsU3QaAH
	Fjiw1I9Hf1qfI6E+Pat33hbGffXUBiqMbb/pftepHxSxppB/FGdtT56a6lk9ERALb/vM5nk7qDj2
	CqhG/ant89obTCzpTP1aU5/6Xg1x79u2ldQ3fPyOi3mje6uP4H58Po5+GP159JdRZ8gYxrCbRKDn
	mrJNyx5/kCJRHQLr2oEDRYD/6ygCXeX+HqwEVnC+poCOG1DjvNqm19yEwCgCpqdI9DLv4HO2N+Ef
	BUikVtDAiyPgfgMHBtT0FBnkbqafsxsCAElWc+DUWT5wKm71prNiYIHbQOsXl0evRMNHAjQSTazm
	SMB0wLp3NgUeAb3oLs8RkIjEqhERW1+8AK2dbxvrb8jV3U9skzMCAEkb6NlZE7DdvfWvqwfeZwf4
	ZvVztok3/J4EAoBYMRJNL66p/zMQKza1awBMe+n0kF/Pcf+TMwIyKgAEAIE20VTVA2nlLPDTe5/Y
	LjXYD+44gbUNxPjURoicfu+BiyHu/KE8R6AtsCZiaVvpHeo5Ymy5455LKz3P+BxZ7x9oWn2kEKGe
	Tc8+lBo8TLoEy23qXkjhAPkIkGfBJdWU/1JRU102MDb/Rf1q8KLkJems7n+B6/cvzA6LZQj2RWUA
	AAAASUVORK5CYII=
	`;
let sl_baseIcon = {
	shadowUrl: shadowPng,
	iconSize: [32, 40],
	shadowSize: [32, 38],
	iconAnchor: [16, 40],
	shadowAnchor: [12, 32],
	popupAnchor: [0, -64],
};

let stlouis_styles = {
	PointsOfInterest: {
		...sl_baseIcon,
		iconUrl: poiPng,
	},
	Parks: {
		color: '#000',
		weight: 2,
		opacity: 1,
		fillColor: '#093',
	},
	Pizza: {
		...sl_baseIcon,
		iconUrl: pizzaPng,
	}
};

let url = stlouis_local;
//url = rivers_local;
//window.viewOptions
//= stlouis_view;
//= [{lat: 38.63400357606173, lng: -90.252685546875}, 14];
//window.styles = stlouis_styles;

window.userData = [
	{mountpoint: 'data', filename: 'StLouis.gpkg', url, method: 'arrayBuffer'},
];
