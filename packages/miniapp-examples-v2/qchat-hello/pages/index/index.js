Page({
  data: {
    title: "QChat Hello",
    count: 0,
    items: ["WXML", "WXSS", "JavaScript"],
  },

  onIncrement() {
    this.setData({ count: this.data.count + 1 });
  },
});
