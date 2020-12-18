/* eslint-env browser */
class ScriptLoader {
	constructor(url) {
		this.url = url;
	}
	async load() {
		return new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
			const node = document.createElement('script');
			node.src = this.url;
			node.async = false;
			node.addEventListener('load', this, false);
			node.addEventListener('error', this, false);
			const head = document.head;
			head.insertBefore(node, head.querySelector('script:nth-last-child(1) + *'));
		});
	}
	handleEvent(e) {
		switch(e.type) {
		case "load":
			this.resolve();
			break;
		case "error":
			this.reject(new Error(`Cannot load ${this.url}`));
			break;
		default:
			return;
		}
		e.target.removeEventListener('load', this, false);
		e.target.removeEventListener('error', this, false);
	}
}

class AsyncPool {
	constructor(list) {
		this.list = list;
		this.index = null;
	}
	async find(action) {
		const list = this.index != null && this.list.length > 1
			? this.list.slice().splice(this.index, 1)
			: this.list;
		const index = parseInt(Math.random() * list.length);
		this.index = index;
		const item = list[index];
		try {
			await action(item);
		} catch(err) {
			await this.sleep(1000);
			await this.some(action);
		}
		return item;
	}
	async do(action) {
		if (this.index == null) await this.find(action);
		else await action(this.list[this.index]);
	}
	forget() {
		this.index = null;
	}
	async sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

export class LiveJack {
	constructor({servers, namespace, version}) {
		if (!servers || servers.length == 0) throw new Error("missing servers");
		if (typeof servers == "string") servers = servers.split(" ");
		this.servers = servers;
		this.namespace = namespace;
		this.version = version;
		this.emitter = document.createElement('div');
		this.pool = new AsyncPool(servers);
	}
	async setup(server) {
		const url = server + '/' + this.namespace;
		if (!this.rooms) this.rooms = {};
		return new Promise((resolve) => {
			let io = this.io;
			if (!io) {
				io = this.io = window.io(url, {
					transports: ['websocket'] // try only websocket
				});
				io.on('connect_error', async (e) => {
					io.io.opts.transports = ['polling', 'websocket']; // fallback to polling but keep trying websocket
					await this.pool.find((server) => this.setup(server));
				});
				io.on('reconnect_error', async (attempts) => {
					await this.pool.find((server) => this.setup(server));
				});
				io.on('connect', function () {
					resolve();
				});
				io.on('message', (data) => this.notify(data));
			} else {
				io.io.uri = url;
			}
		}).then(() => {
			const olds = this.rooms;
			this.rooms = {};
			for (let room in olds) {
				this.join(room, olds[room]);
			}
		});
	}
	async init() {
		const server = await this.pool.find(async (url) => {
			if (url.substring(0, 2) == '//') url = (document.location.protocol || 'http:') + url;
			const loader = new ScriptLoader([
				url.substring(0, 2) == '//' ? (document.location.protocol || 'http:') : '',
				url,
				'/socket.io/socket.io.js',
				this.version ? `?ver=${this.version}` : ''
			].join(''));
			await loader.load();
			if (!window.io) throw new Error("script did not load window.io");
		});
		await this.setup(server);
	}
	join(room, mtime, listener = null) {
		const joined = room in this.rooms;
		this.rooms[room] = mtime;
		if (!joined) this.io.emit('join', { room, mtime });
		if (listener) this.emitter.addEventListener(room, listener, false);
	}
	notify(data) {
		const e = new CustomEvent(data.room || data.key, {
			view: window,
			bubbles: true,
			cancelable: true,
			detail: data
		});
		this.emitter.dispatchEvent(e);
	}

}
