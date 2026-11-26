export default Page({ data: { from: "" }, onLoad(q) { this.setData({ from: q.from || "" }); } });
