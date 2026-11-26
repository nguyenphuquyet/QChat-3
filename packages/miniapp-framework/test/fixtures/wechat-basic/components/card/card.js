export default Component({
  properties: { title: { type: String, value: "" } },
  methods: { tap() { this.triggerEvent("cardtap", { title: this.properties.title }); } },
});
