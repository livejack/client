/* eslint-env node */
const io = require('socket.io-client');
const URL = require('url');
const debug = require('debug')('livejack:client');
const EventEmitter = require('events');

module.exports = class LiveJack extends EventEmitter {
	constructor({ servers, namespace, token }) {
		super();
		this.pool = servers.map(function (str) {
			str = str.trim();
			// if a url without protocol was given, always default to https
			if (str.substring(0, 2) == "//") str = "https:" + str;
			return URL.parse(str);
		});
		this.namespace = namespace;
		this.token = token;
		const socket = this.socket = io(this.iouri());
		socket.on('message', (msg) => {
			this.emit('message', msg);
		});
		socket.on('connect', function () {
			socket.emit('join', { room: '*' });
		});
		socket.on('error', (e) => {
			this.emit('error', e);
		});
		socket.on('connect_error', (e) => {
			if (!e) e = "connect error";
			// eslint-disable-next-line no-console
			console.error(e.toString(), socket.io.uri);
			socket.io.uri = this.iouri();
		});
		socket.on('reconnect_error', (e) => {
			if (!e) e = "reconnect error";
			// eslint-disable-next-line no-console
			console.error(e.toString(), socket.io.uri);
			socket.io.uri = this.iouri();
		});
	}
	iouri() {
		const iohost = this.pool[parseInt(Math.random() * this.pool.length)];
		iohost.pathname = this.namespace;
		iohost.query = {
			token: this.token
		};
		return URL.format(iohost);
	}
	send(msg) {
		debug('emit', msg);
		if (msg.room) {
			msg.key = msg.room;
			delete msg.room;
		}
		this.socket.emit('message', msg);
	}
};
