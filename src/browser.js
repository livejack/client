/* eslint-env browser */
import AsyncPool from "./async-pool.js";
import ScriptLoader from "./script-loader.js";

export class LiveJack extends EventTarget {
	#incident = false;

	async init({ servers, namespace, version }) {
		if (!servers || servers.length == 0) throw new Error("missing servers");
		if (typeof servers == "string") servers = servers.split(" ");
		this.servers = servers.map((url) => {
			if (url.startsWith('//')) {
				url = document.location.protocol + url;
			}
			return url;
		});
		this.namespace = namespace;
		this.version = version;
		this.pool = new AsyncPool(servers);
		await this.load();
	}
	#start(server) {
		const url = server + '/' + this.namespace;
		if (!this.rooms) this.rooms = {};
		let io = this.io;
		if (!io) {
			io = this.io = window.io(url, {
				// try only websocket
				transports: ['websocket']
			});
			io.on('connect', () => {
				this.joinAll();
			});
			io.on('connect_error', (e) => {
				this.#incident = true;
				// fallback to polling but keep trying websocket
				io.io.opts.transports = ['polling', 'websocket'];
				this.pool.find((server) => this.#start(server));
			});
			io.on('disconnect', (e) => {
				this.#incident = true;
				this.emit('ioerror', { message: 'disconnect' });
			});
			io.on('connect', (e) => {
				if (this.#incident) {
					this.#incident = false;
					this.emit('ioerror', { message: 'reconnect' });
				}
			});
			io.on('message', (data) => this.emit(data.room || data.key, data));
		} else {
			io.io.uri = url;
		}
	}
	async load() {
		const query = this.version ? `?ver=${this.version}` : '';
		const server = await this.pool.find(async (url) => {
			const loader = new ScriptLoader(`${url}/socket.io/socket.io.js${query}`);
			try {
				await loader.load();
				if (!window.io) throw new Error("script did not load window.io");
			} catch (err) {
				this.#incident = true;
				this.emit('ioerror', { message: 'offline' });
				throw err;
			}
		});
		this.#start(server);
	}
	join(room, mtime, listener = null) {
		this.rooms[room] = mtime;
		if (listener) {
			this.addEventListener(room, listener, false);
		}
		if (this.io.connected) {
			this.io.emit('join', { room, mtime });
		} else {
			// do nothing, joinAll is called upon connect
		}
	}
	joinAll() {
		for (const [room, mtime] of Object.entries(this.rooms)) {
			this.join(room, mtime);
		}
	}
	emit(type, data) {
		const e = new CustomEvent(type, {
			view: window,
			bubbles: true,
			cancelable: true,
			detail: data
		});
		this.dispatchEvent(e);
	}

}
