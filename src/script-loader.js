class Loader {
	constructor(url, attrs) {
		this.url = url;
		this.attrs = attrs;
	}
	async load() {
		return new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
			const node = document.createElement('script');
			node.src = this.url;
			for (const key in this.attrs) node.setAttribute(key, this.attrs[key]);
			node.async = true;
			node.addEventListener('load', this, false);
			node.addEventListener('error', this, false);
			const head = document.head;
			head.insertBefore(node, head.querySelector('script:nth-last-child(1) + *'));
		});
	}
	handleEvent(e) {
		switch (e.type) {
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

export default async function(url, attrs) {
	const inst = new Loader(url, attrs);
	return inst.load();
}
