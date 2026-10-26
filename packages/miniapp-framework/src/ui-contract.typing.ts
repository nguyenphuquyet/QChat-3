// AUTO-GENERATED FILE - DO NOT EDIT BY HAND.
// Source of truth: packages/contracts/miniapp-ui.contract.json
// Regenerate: corepack pnpm contract:generate
/* eslint-disable */

import type { Style } from "./protocol.js";
import type { ActivityIndicatorProps, AnimatedViewProps, BottomSheetProps, ButtonProps, CheckboxProps, CustomPaintProps, DialogProps, DividerProps, GridViewProps, IconProps, ImageProps, ListViewProps, ModalProps, NavBarProps, PositionedProps, PressableProps, SafeAreaProps, ScrollViewProps, SliderProps, SpacerProps, StackProps, SwitchProps, TabBarProps, TextFieldProps, TextProps, ViewProps } from "./ui.js";

// Both directions: a key missing from `Style` or an extra key on `Style`
// fails to compile.
const STYLE_KEYS_CONFORMANCE: Record<keyof Required<Style>, true> = {
  width: true,
  height: true,
  minWidth: true,
  minHeight: true,
  maxWidth: true,
  maxHeight: true,
  padding: true,
  paddingHorizontal: true,
  paddingVertical: true,
  paddingTop: true,
  paddingRight: true,
  paddingBottom: true,
  paddingLeft: true,
  margin: true,
  marginHorizontal: true,
  marginVertical: true,
  marginTop: true,
  marginRight: true,
  marginBottom: true,
  marginLeft: true,
  gap: true,
  rowGap: true,
  columnGap: true,
  flex: true,
  flexGrow: true,
  flexShrink: true,
  flexBasis: true,
  flexDirection: true,
  flexWrap: true,
  alignItems: true,
  justifyContent: true,
  alignSelf: true,
  alignContent: true,
  position: true,
  top: true,
  right: true,
  bottom: true,
  left: true,
  zIndex: true,
  overflow: true,
  aspectRatio: true,
  backgroundColor: true,
  color: true,
  opacity: true,
  borderRadius: true,
  borderTopLeftRadius: true,
  borderTopRightRadius: true,
  borderBottomLeftRadius: true,
  borderBottomRightRadius: true,
  borderWidth: true,
  borderColor: true,
  borderTopWidth: true,
  borderTopColor: true,
  borderRightWidth: true,
  borderRightColor: true,
  borderBottomWidth: true,
  borderBottomColor: true,
  borderLeftWidth: true,
  borderLeftColor: true,
  fontSize: true,
  fontWeight: true,
  fontStyle: true,
  fontFamily: true,
  lineHeight: true,
  letterSpacing: true,
  textAlign: true,
  textDecoration: true,
  textTransform: true,
  numberOfLines: true,
  shadow: true,
  boxShadow: true,
  elevation: true,
  gradient: true,
  rotate: true,
  scale: true,
  translateX: true,
  translateY: true,
};

const STYLE_KEYS_SEEN: readonly (keyof Required<Style>)[] = Object.keys(
  STYLE_KEYS_CONFORMANCE,
) as (keyof Required<Style>)[];
void STYLE_KEYS_SEEN;
void STYLE_KEYS_CONFORMANCE;

// View
const ViewProps_CONFORMANCE: Record<keyof ViewProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
};
void ViewProps_CONFORMANCE;

// Text
const TextProps_CONFORMANCE: Record<keyof TextProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  numberOfLines: true,
  selectable: true,
};
void TextProps_CONFORMANCE;

// Button
const ButtonProps_CONFORMANCE: Record<keyof ButtonProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  onPress: true,
  onLongPress: true,
  disabled: true,
  variant: true,
  loading: true,
  icon: true,
};
void ButtonProps_CONFORMANCE;

// Pressable
const PressableProps_CONFORMANCE: Record<keyof PressableProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  onPress: true,
  onLongPress: true,
  disabled: true,
};
void PressableProps_CONFORMANCE;

// Image
const ImageProps_CONFORMANCE: Record<keyof ImageProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  src: true,
  width: true,
  height: true,
  fit: true,
  borderRadius: true,
  onPress: true,
};
void ImageProps_CONFORMANCE;

// Icon
const IconProps_CONFORMANCE: Record<keyof IconProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  name: true,
  size: true,
  color: true,
};
void IconProps_CONFORMANCE;

// TextField
const TextFieldProps_CONFORMANCE: Record<keyof TextFieldProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  value: true,
  placeholder: true,
  onInput: true,
  onChange: true,
  onSubmit: true,
  onFocus: true,
  onBlur: true,
  secureTextEntry: true,
  multiline: true,
  maxLength: true,
  keyboardType: true,
  editable: true,
  autoFocus: true,
};
void TextFieldProps_CONFORMANCE;

// Checkbox
const CheckboxProps_CONFORMANCE: Record<keyof CheckboxProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  checked: true,
  onChange: true,
  onCheckedChange: true,
  label: true,
  disabled: true,
};
void CheckboxProps_CONFORMANCE;

// Switch
const SwitchProps_CONFORMANCE: Record<keyof SwitchProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  value: true,
  onChange: true,
  onValueChange: true,
  disabled: true,
};
void SwitchProps_CONFORMANCE;

// Slider
const SliderProps_CONFORMANCE: Record<keyof SliderProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  value: true,
  min: true,
  max: true,
  step: true,
  onChange: true,
  onValueChange: true,
  disabled: true,
};
void SliderProps_CONFORMANCE;

// ScrollView
const ScrollViewProps_CONFORMANCE: Record<keyof ScrollViewProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  horizontal: true,
  vertical: true,
  showsScrollIndicator: true,
  onScroll: true,
  grid: true,
  numColumns: true,
};
void ScrollViewProps_CONFORMANCE;

// ListView
const ListViewProps_CONFORMANCE: Record<keyof ListViewProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  data: true,
  horizontal: true,
  empty: true,
  renderItem: true,
  keyExtractor: true,
};
void ListViewProps_CONFORMANCE;

// GridView
const GridViewProps_CONFORMANCE: Record<keyof GridViewProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  data: true,
  numColumns: true,
  empty: true,
  renderItem: true,
};
void GridViewProps_CONFORMANCE;

// Stack
const StackProps_CONFORMANCE: Record<keyof StackProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  alignment: true,
};
void StackProps_CONFORMANCE;

// Positioned
const PositionedProps_CONFORMANCE: Record<keyof PositionedProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  top: true,
  right: true,
  bottom: true,
  left: true,
};
void PositionedProps_CONFORMANCE;

// Spacer
const SpacerProps_CONFORMANCE: Record<keyof SpacerProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  size: true,
};
void SpacerProps_CONFORMANCE;

// Divider
const DividerProps_CONFORMANCE: Record<keyof DividerProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  color: true,
  thickness: true,
};
void DividerProps_CONFORMANCE;

// ActivityIndicator
const ActivityIndicatorProps_CONFORMANCE: Record<keyof ActivityIndicatorProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  size: true,
  color: true,
};
void ActivityIndicatorProps_CONFORMANCE;

// SafeArea
const SafeAreaProps_CONFORMANCE: Record<keyof SafeAreaProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  edges: true,
};
void SafeAreaProps_CONFORMANCE;

// AnimatedView
const AnimatedViewProps_CONFORMANCE: Record<keyof AnimatedViewProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  animate: true,
  duration: true,
};
void AnimatedViewProps_CONFORMANCE;

// CustomPaint
const CustomPaintProps_CONFORMANCE: Record<keyof CustomPaintProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  draw: true,
  width: true,
  height: true,
};
void CustomPaintProps_CONFORMANCE;

// Modal
const ModalProps_CONFORMANCE: Record<keyof ModalProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  visible: true,
  onClose: true,
  transparent: true,
  animationType: true,
};
void ModalProps_CONFORMANCE;

// BottomSheet
const BottomSheetProps_CONFORMANCE: Record<keyof BottomSheetProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  visible: true,
  onClose: true,
  height: true,
};
void BottomSheetProps_CONFORMANCE;

// Dialog
const DialogProps_CONFORMANCE: Record<keyof DialogProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  visible: true,
  title: true,
  onClose: true,
  onConfirm: true,
  confirmText: true,
  cancelText: true,
};
void DialogProps_CONFORMANCE;

// NavBar
const NavBarProps_CONFORMANCE: Record<keyof NavBarProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  title: true,
  subtitle: true,
  onBack: true,
  showBack: true,
  safeArea: true,
  reserveRight: true,
};
void NavBarProps_CONFORMANCE;

// TabBar
const TabBarProps_CONFORMANCE: Record<keyof TabBarProps, true> = {
  key: true,
  ref: true,
  style: true,
  children: true,
  testID: true,
  accessibleLabel: true,
  pointerEvents: true,
  tabs: true,
  activeKey: true,
  activeIndex: true,
  onChange: true,
  safeArea: true,
};
void TabBarProps_CONFORMANCE;

export {};
