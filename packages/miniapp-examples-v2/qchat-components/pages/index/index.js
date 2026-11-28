Page({
  data: {
    title: "Hello",
    heading: "Head",
    count: 0,
    clicks: 0,
  },
  onCardChange(event) {
    this.setData({ clicks: event.detail.clicks });
  },
  onAdd() {
    this.setData({ count: this.data.count + 1 });
  },
});
