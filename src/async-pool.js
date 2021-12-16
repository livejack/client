export default class AsyncPool {
	constructor(list) {
		this.list = list;
		this.index = null;
	}
	async try(action) {
		// pick a random index except previous one if possible
		const list = this.list.slice();
		const old = this.index == null ? -1 : this.index;
		const other = old >= 0 && list.length > 1;
		if (other) list.splice(old, 1);
		const cur = parseInt(Math.random() * list.length);
		const item = list[cur];
		this.index = (other && cur >= old) ? cur + 1 : cur;
		await action(item);
		return item;
	}
	async find(action) {
		let item;
		try {
			item = await this.try(action);
		} catch (err) {
			await this.sleep(1000);
			item = this.find(action);
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
