//#region src/rt.ts
var e, t, n;
function r(r) {
	t = r, e = r.react, n = r.ui;
}
//#endregion
//#region src/prefs.ts
var i = { maxGapMinutes: 10 }, a = [1, 120], o = [{
	key: "maxGapMinutes",
	label: "Track gap limit (minutes)",
	hint: "Photos are not placed between two track points further apart than this.",
	type: "number",
	default: i.maxGapMinutes,
	min: a[0],
	max: a[1],
	step: 1
}], s = "lastOffsetSeconds";
function c(e, t) {
	return typeof t == "number" && Number.isFinite(t) ? Math.min(a[1], Math.max(a[0], t)) : i[e];
}
function l(e) {
	return { maxGapMinutes: c("maxGapMinutes", e("maxGapMinutes", i.maxGapMinutes)) };
}
function u() {
	let [n, r] = e.useState(() => l(t.settings.get));
	return e.useEffect(() => t.settings.onChange(() => r(l(t.settings.get))), []), n;
}
function ee(e) {
	let t = e(s, 0);
	return typeof t == "number" && Number.isFinite(t) ? Math.round(t) : 0;
}
function te(e) {
	t.settings.set(s, Math.round(e));
}
//#endregion
//#region src/gpx.ts
var d = "*";
function f(e, t) {
	for (let n of Array.from(e.children)) if (n.localName === t) return n.textContent;
	return null;
}
function p(e, t) {
	let n = e.getAttribute(t)?.trim();
	if (!n) return null;
	let r = Number(n);
	return Number.isFinite(r) ? r : null;
}
var m = /(?:Z|[+-]\d{2}:?\d{2})$/i;
function h(e) {
	let t = e?.trim();
	if (!t) return NaN;
	let n = t.includes("T") && !m.test(t);
	return Date.parse(n ? `${t}Z` : t);
}
function g(e, t) {
	let n = [];
	for (let r of Array.from(e.children)) {
		if (r.localName !== t) continue;
		let e = p(r, "lat"), i = p(r, "lon"), a = h(f(r, "time"));
		if (e === null || i === null || Math.abs(e) > 90 || Math.abs(i) > 180 || Number.isNaN(a)) continue;
		let o = f(r, "ele"), s = o === null ? NaN : Number(o);
		n.push(Number.isFinite(s) ? {
			t: a,
			lon: i,
			lat: e,
			ele: s
		} : {
			t: a,
			lon: i,
			lat: e
		});
	}
	return n.sort((e, t) => e.t - t.t);
}
function ne(e) {
	let t = new DOMParser().parseFromString(e, "application/xml"), n = t.documentElement;
	if (!n || n.localName !== "gpx" || t.getElementsByTagNameNS(d, "parsererror").length > 0) return {
		ok: !1,
		reason: "invalid-xml"
	};
	let r = [];
	for (let e of Array.from(t.getElementsByTagNameNS(d, "trkseg"))) {
		let t = g(e, "trkpt");
		t.length && r.push(t);
	}
	if (r.length === 0) for (let e of Array.from(t.getElementsByTagNameNS(d, "rte"))) {
		let t = g(e, "rtept");
		t.length && r.push(t);
	}
	if (r.length === 0) return {
		ok: !1,
		reason: "no-points"
	};
	let i = t.getElementsByTagNameNS(d, "trk")[0];
	return {
		ok: !0,
		track: {
			name: i && f(i, "name")?.trim() || null,
			segments: r,
			pointCount: r.reduce((e, t) => e + t.length, 0),
			..._(r)
		}
	};
}
function _(e) {
	let t = Infinity, n = -Infinity;
	for (let r of e) r.length !== 0 && (t = Math.min(t, r[0].t), n = Math.max(n, r[r.length - 1].t));
	return {
		start: t,
		end: n
	};
}
function v(e) {
	return {
		type: "FeatureCollection",
		features: e.segments.filter((e) => e.length >= 2).map((e) => ({
			type: "Feature",
			geometry: {
				type: "LineString",
				coordinates: e.map((e) => [e.lon, e.lat])
			},
			properties: {}
		}))
	};
}
//#endregion
//#region src/store.ts
var y = {
	track: null,
	file: null
}, b = null;
function x() {
	b = t.stores.create((e, t) => ({
		loaded: y,
		undo: [],
		setLoaded: (t) => e({ loaded: t }),
		pushUndo: (n) => e({ undo: [...t().undo, n].slice(-20) }),
		popUndo: () => {
			let n = t().undo, r = n[n.length - 1];
			return r && e({ undo: n.slice(0, -1) }), r;
		}
	}));
}
function S() {
	if (b === null) throw Error("[gps-track] store() called before activate()");
	return b;
}
function C(e) {
	return S()(e);
}
//#endregion
//#region src/state.ts
var w = "gps-track.state", T = "The GPX track GPS Track has loaded, shared by its panel in every window.", E = "map.overlays", D = "Lines and points drawn on the Map. One entry per extension, keyed by its id; add and remove your own with update().", O = "gps-track", k = null;
function A(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function j(e) {
	return typeof e == "number" && Number.isFinite(e);
}
function M(e) {
	return A(e) && j(e.t) && j(e.lat) && j(e.lon) && (e.ele === void 0 || j(e.ele));
}
function N(e) {
	return A(e) && (e.name === null || typeof e.name == "string") && j(e.pointCount) && j(e.start) && j(e.end) && Array.isArray(e.segments) && e.segments.every((e) => Array.isArray(e) && e.every(M));
}
function P(e) {
	return A(e) && (e.file === null || typeof e.file == "string") && (e.track === null || N(e.track));
}
function F(e) {
	return P(e) ? e : y;
}
function I() {
	t.variables.register(w, {
		initial: y,
		description: T
	}), t.variables.register(E, {
		initial: {},
		description: D
	}), k = t.variables.subscribe(w, (e) => {
		P(e.value) ? S().getState().setLoaded(e.value) : (console.warn("[gps-track] ignored a gps-track.state value that isn't a track"), S().getState().setLoaded(y));
	});
}
function L() {
	let e = t.variables.get(E)?.value;
	A(e) && Object.hasOwn(e, "gps-track") && t.variables.update(E, ({ [O]: e, ...t }) => t);
}
function re(e, n) {
	t.variables.set("gps-track.state", {
		track: e,
		file: n
	}).ok && t.variables.update(E, (t) => ({
		...t,
		[O]: {
			label: n,
			geojson: v(e)
		}
	}));
}
function ie() {
	t.variables.set("gps-track.state", y).ok && L();
}
function R() {
	L(), F(t.variables.get("gps-track.state")?.value).track && t.variables.set(w, y), k?.(), k = null;
}
//#endregion
//#region src/exif-time.ts
var z = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;
function B(e) {
	if (!e) return;
	let t = z.exec(e);
	if (!t) return;
	let [, n, r, i, a, o, s] = t, c = new Date(+n, r - 1, +i, +a, +o, +s).getTime();
	return Number.isNaN(c) ? void 0 : c;
}
//#endregion
//#region src/correlate.ts
function V(e, t, n) {
	let r = t.t - e.t, i = r === 0 ? 0 : (n - e.t) / r, a = {
		lat: e.lat + (t.lat - e.lat) * i,
		lon: e.lon + (t.lon - e.lon) * i
	};
	return e.ele !== void 0 && t.ele !== void 0 && (a.alt = e.ele + (t.ele - e.ele) * i), a;
}
function H(e) {
	return e.ele === void 0 ? {
		lat: e.lat,
		lon: e.lon
	} : {
		lat: e.lat,
		lon: e.lon,
		alt: e.ele
	};
}
function ae(e, t) {
	let n = 0, r = e.length - 1;
	for (; n < r;) {
		let i = n + r + 1 >> 1;
		e[i].t <= t ? n = i : r = i - 1;
	}
	return n;
}
function U(e, t, n) {
	let r = Math.abs(t.t - n);
	return !e || r < e.distance ? {
		distance: r,
		point: t
	} : e;
}
function oe(e, t, n) {
	let r = !1, i = null;
	for (let a of e) {
		if (a.length === 0) continue;
		let e = a[0], o = a[a.length - 1];
		if (t >= e.t && t <= o.t) {
			let e = ae(a, t), o = a[e];
			if (o.t === t || e === a.length - 1) return { fix: H(o) };
			let s = a[e + 1];
			if (s.t - o.t <= n) return { fix: V(o, s, t) };
			r = !0, i = U(U(i, o, t), s, t);
		} else i = U(U(i, e, t), o, t);
	}
	return i && i.distance <= n / 2 ? { fix: H(i.point) } : { reason: r ? "gap" : "outside-track" };
}
function se(e, t, n) {
	return e.map((e) => {
		let r = B(e.exif.dateTimeOriginal);
		if (r === void 0) return {
			id: e.id,
			fix: null,
			reason: "no-time"
		};
		let i = oe(t.segments, r + n.offsetMs, n.maxGapMs);
		return "fix" in i ? {
			id: e.id,
			fix: i.fix
		} : {
			id: e.id,
			fix: null,
			reason: i.reason
		};
	});
}
function ce(e) {
	let t = {
		matched: 0,
		unmatched: 0,
		noTime: 0,
		outside: 0,
		gap: 0
	};
	for (let n of e) n.fix ? t.matched++ : (t.unmatched++, n.reason === "no-time" ? t.noTime++ : n.reason === "outside-track" ? t.outside++ : n.reason === "gap" && t.gap++);
	return t;
}
//#endregion
//#region src/geo.ts
function W(e) {
	let { gpsLatitude: t, gpsLongitude: n } = e.exif;
	return t === void 0 || n === void 0 || !Number.isFinite(t) || !Number.isFinite(n) || t < -90 || t > 90 || n < -180 || n > 180 ? null : {
		lon: n,
		lat: t
	};
}
function G(e) {
	return W(e) !== null;
}
//#endregion
//#region src/geotag.ts
function le(e) {
	let { gpsLatitude: t, gpsLongitude: n, gpsAltitude: r } = e.exif;
	return t === void 0 || n === void 0 ? null : r === void 0 ? {
		lat: t,
		lon: n
	} : {
		lat: t,
		lon: n,
		alt: r
	};
}
function K(e, t) {
	let { gpsAltitude: n, ...r } = e.exif, i = {
		...r,
		gpsLatitude: t.lat,
		gpsLongitude: t.lon
	};
	return {
		...e,
		exif: t.alt === void 0 ? i : {
			...i,
			gpsAltitude: t.alt
		}
	};
}
function ue(e) {
	let { gpsLatitude: t, gpsLongitude: n, gpsAltitude: r, ...i } = e.exif;
	return {
		...e,
		exif: i
	};
}
var de = (e, t, n) => `${e} ${e === 1 ? t : n}`, fe = (e) => `Undo tagging ${de(e, "photo", "photos")} from the track`;
async function pe(e, t, n) {
	let r = new Map(n.photos().map((e) => [e.id, e])), i = e.flatMap((e) => {
		let t = r.get(e.id);
		return t ? [{
			before: t,
			after: K(t, e.fix)
		}] : [];
	});
	return i.length === 0 ? 0 : (await n.relocate(i.map((e) => e.after)), n.pushUndo({
		label: t,
		previous: new Map(i.map((e) => [e.before.id, le(e.before)]))
	}), i.length);
}
async function me(e, t) {
	let n = new Map(t.photos().map((e) => [e.id, e])), r = [];
	for (let [t, i] of e.previous) {
		let e = n.get(t);
		e && r.push(i ? K(e, i) : ue(e));
	}
	r.length && await t.relocate(r);
}
var q = null;
function he(e = J()) {
	return q || (q = (async () => {
		let t = S().getState().popUndo();
		if (t) try {
			await me(t, e);
		} catch (e) {
			throw S().getState().pushUndo(t), e;
		}
	})().finally(() => {
		q = null;
	}), q);
}
function J() {
	let e = t.stores.useCatalogStore;
	return {
		photos: () => e.getState().photos,
		relocate: (t) => e.getState().relocatePhotos(t),
		pushUndo: (e) => S().getState().pushUndo(e)
	};
}
//#endregion
//#region src/offset.ts
var ge = /^([+-])?(?:(\d+):)?(?:(\d{1,2}):)?(\d{1,2}|\d+)$/;
function _e(e) {
	let t = e.trim();
	if (t === "") return 0;
	let n = ge.exec(t);
	if (!n) return null;
	let [, r, i, a, o] = n, s = [
		i,
		a,
		o
	].filter((e) => e !== void 0).map(Number);
	if (s.length > 1 && s.slice(1).some((e) => e > 59)) return null;
	let c = s.reduce((e, t) => e * 60 + t, 0);
	return r === "-" ? -c : c;
}
function ve(e) {
	let t = Math.abs(Math.round(e)), n = Math.floor(t / 3600), r = Math.floor(t % 3600 / 60), i = t % 60, a = (e) => String(e).padStart(2, "0");
	return `${e < 0 ? "-" : ""}${n}:${a(r)}:${a(i)}`;
}
//#endregion
//#region src/TrackPanel.tsx
var ye = "map.in-view", Y = (e, t, n) => `${e} ${e === 1 ? t : n}`, X = (e) => e instanceof Error ? e.message : String(e);
function be(e, t) {
	return e > 0 ? `Targets: ${Y(e, "selected photo", "selected photos")}` : `Targets: ${Y(t, "untagged photo", "untagged photos")} in view`;
}
function Z(e) {
	let t = [
		e.noTime > 0 ? `${e.noTime} no capture time` : null,
		e.outside > 0 ? `${e.outside} outside the track` : null,
		e.gap > 0 ? `${e.gap} across a gap` : null
	].filter((e) => e !== null);
	return `${e.matched} matched · ${e.unmatched} unmatched${t.length ? ` (${t.join(", ")})` : ""}`;
}
var xe = (e, t) => `${new Date(e).toLocaleString()} – ${new Date(t).toLocaleTimeString()}`;
function Se({ readFile: r = (e) => e.text() }) {
	let i = u(), { track: a, file: o } = C((e) => e.loaded), s = C((e) => e.undo), c = s[s.length - 1], l = t.stores.useCatalogStore, d = l((e) => e.photos), f = l((e) => e.selectedIds), p = t.catalog.useVisiblePhotos({ without: [ye] }), [m, h] = e.useState(() => ve(ee(t.settings.get))), [g, _] = e.useState(i.maxGapMinutes), [v, y] = e.useState(!1), [b, x] = e.useState(null), [S, w] = e.useState(!1), T = e.useRef(null), { Button: E, Toggle: D, NumberInput: O, TextInput: k, Field: A, Section: j, Stack: M, Row: N } = n, P = _e(m), F = e.useMemo(() => p.filter((e) => !G(e)), [p]), I = e.useMemo(() => d.filter((e) => f.has(e.id)), [d, f]), L = e.useMemo(() => {
		let e = I.length > 0 ? I : F;
		return v ? e : e.filter((e) => !G(e));
	}, [
		I,
		F,
		v
	]), R = e.useMemo(() => a && P !== null ? se(L, a, {
		offsetMs: P * 1e3,
		maxGapMs: g * 6e4
	}) : [], [
		a,
		L,
		P,
		g
	]), z = e.useMemo(() => ce(R), [R]), B = async (e) => {
		let t = e.target.files?.[0];
		if (e.target.value = "", !t) return;
		x(null);
		let n;
		try {
			n = ne(await r(t));
		} catch {
			x(`Could not read ${t.name}.`);
			return;
		}
		n.ok ? re(n.track, t.name) : x(n.reason === "invalid-xml" ? `${t.name} is not a GPX file.` : `No timed track points in ${t.name}.`);
	}, V = async () => {
		if (a && P !== null) {
			w(!0), x(null);
			try {
				let e = R.flatMap((e) => e.fix ? [{
					id: e.id,
					fix: e.fix
				}] : []), t = await pe(e, fe(e.length), J());
				te(P), x(`Tagged ${Y(t, "photo", "photos")}.`);
			} catch (e) {
				x(X(e));
			} finally {
				w(!1);
			}
		}
	}, H = async () => {
		w(!0), x(null);
		try {
			await he();
		} catch (e) {
			x(X(e));
		} finally {
			w(!1);
		}
	};
	return /* @__PURE__ */ e.createElement(M, {
		gap: 10,
		style: {
			padding: 8,
			fontSize: 11
		}
	}, /* @__PURE__ */ e.createElement(j, {
		title: "GPS track",
		right: /* @__PURE__ */ e.createElement(E, {
			size: "sm",
			onClick: () => T.current?.click()
		}, "Import track…")
	}, /* @__PURE__ */ e.createElement("input", {
		ref: T,
		type: "file",
		accept: ".gpx,application/gpx+xml",
		"aria-label": "Import track",
		style: { display: "none" },
		onChange: (e) => void B(e)
	}), a ? /* @__PURE__ */ e.createElement(M, { gap: 6 }, /* @__PURE__ */ e.createElement("span", { style: { color: n.tokens.textSecondary } }, a.name ?? o, " · ", Y(a.pointCount, "point", "points"), " · ", xe(a.start, a.end)), /* @__PURE__ */ e.createElement(N, { gap: 6 }, /* @__PURE__ */ e.createElement(E, {
		size: "sm",
		variant: "ghost",
		onClick: () => {
			ie(), x(null);
		}
	}, "Clear"))) : /* @__PURE__ */ e.createElement("span", { style: { color: n.tokens.textMuted } }, "No track loaded. Import a .gpx file recorded while you shot.")), /* @__PURE__ */ e.createElement(j, { title: "Match by time" }, /* @__PURE__ */ e.createElement(A, {
		label: "Camera clock offset",
		hint: "Added to each photo's capture time: the camera clock's error, plus the time-zone difference if the camera was set to another zone than this computer. A camera 5 minutes slow needs +0:05:00."
	}, /* @__PURE__ */ e.createElement(k, {
		value: m,
		onChange: h,
		placeholder: "±h:mm:ss",
		"aria-label": "Camera clock offset"
	}), P === null && /* @__PURE__ */ e.createElement("span", { style: { color: n.tokens.textSecondary } }, "Offset must be ±h:mm:ss.")), /* @__PURE__ */ e.createElement(A, {
		label: "Gap limit (minutes)",
		hint: "Photos are not placed between two track points further apart than this."
	}, /* @__PURE__ */ e.createElement(O, {
		value: g,
		min: 1,
		max: 120,
		step: 1,
		onChange: (e) => _(Math.min(120, Math.max(1, Math.round(e) || 1))),
		"aria-label": "Gap limit"
	})), /* @__PURE__ */ e.createElement(D, {
		checked: v,
		onChange: y,
		label: "Overwrite existing locations",
		ariaLabel: "Overwrite existing locations"
	}), /* @__PURE__ */ e.createElement("span", { style: { color: n.tokens.textSecondary } }, be(I.length, F.length)), a && P !== null && /* @__PURE__ */ e.createElement("span", { style: { color: n.tokens.textSecondary } }, Z(z)), /* @__PURE__ */ e.createElement(N, { gap: 6 }, /* @__PURE__ */ e.createElement(E, {
		size: "sm",
		variant: "primary",
		disabled: !a || P === null || z.matched === 0 || S,
		onClick: () => void V()
	}, "Apply"), c && /* @__PURE__ */ e.createElement(E, {
		size: "sm",
		disabled: S,
		title: "Restore the locations these photos had before",
		onClick: () => void H()
	}, c.label)), b && /* @__PURE__ */ e.createElement("span", { style: { color: n.tokens.textSecondary } }, b)));
}
//#endregion
//#region src/index.tsx
var Q = "gps-track.panel", $ = "GPS Track";
function Ce(e) {
	r(e), x(), I(), e.registerPanel({
		id: Q,
		title: "GPS Track",
		component: Se,
		defaultDock: {
			module: "library",
			direction: "right",
			order: 0,
			width: 280
		},
		replaces: ["map.track"]
	}), e.registerSettings({
		title: $,
		keywords: [
			"gps",
			"gpx",
			"track",
			"geotag",
			"offset",
			"location"
		],
		fields: [...o]
	});
}
function we() {
	try {
		R();
	} catch {}
}
//#endregion
export { Q as PANEL_ID, $ as SETTINGS_TITLE, Ce as activate, we as deactivate };

//# sourceMappingURL=index.js.map