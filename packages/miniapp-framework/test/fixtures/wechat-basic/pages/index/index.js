export default Page({
  data: { count: 0, show: false, items: ["a", "b"], title: "Hello" },
  inc() { this.setData({ count: this.data.count + 1 }); },
  reveal() { this.setData({ show: true }); },
  onCard(e) { this.setData({ title: "Tapped:" + e.detail.title }); },
});
