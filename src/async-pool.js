export default class AsyncPool {
	constructor(list) {
		this.list = list;
		this.index = null;
	}
	async try(action) {
		const list = this.index != null && this.list.length > 1
			? this.list.slice().splice(this.index, 1)
			: this.list;
		const index = parseInt(Math.random() * list.length);
		this.index = index;
		const item = list[index];
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
