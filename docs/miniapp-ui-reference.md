# Mini App UI reference (generated)

Generated from `packages/contracts/miniapp-ui.contract.json` by
`corepack pnpm contract:generate`. Do not edit by hand; edit the contract and
regenerate so the TypeScript SDK, the Flutter host and the Studio typings stay
in sync.

## Components

| Component | Props | Events |
| --- | --- | --- |
| `View` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children` | — |
| `Row` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children` | — |
| `Column` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children` | — |
| `Text` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `numberOfLines`, `selectable` | — |
| `RichText` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `numberOfLines`, `selectable` | — |
| `Link` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `href`, `external`, `onPress`, `disabled` | `press` |
| `Badge` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `count`, `max`, `dot`, `visible`, `tone` | — |
| `Tag` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `tone`, `size` | — |
| `Avatar` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `src`, `name`, `size`, `shape` | — |
| `Button` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `onPress`, `onLongPress`, `disabled`, `variant`, `size`, `loading`, `icon` | `press`, `longPress` |
| `Pressable` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `onPress`, `onLongPress`, `disabled` | `press`, `longPress` |
| `Image` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `src`, `width`, `height`, `fit`, `borderRadius`, `onPress` | `press` |
| `Icon` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `name`, `size`, `color` | — |
| `TextField` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `value`, `placeholder`, `onInput`, `onChange`, `onSubmit`, `onFocus`, `onBlur`, `secureTextEntry`, `multiline`, `maxLength`, `keyboardType`, `editable`, `autoFocus` | `input`, `change`, `submit`, `focus`, `blur` |
| `Checkbox` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `checked`, `onChange`, `onCheckedChange`, `label`, `disabled` | `change` |
| `Switch` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `value`, `onChange`, `onValueChange`, `disabled` | `change`, `valueChange` |
| `Slider` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `value`, `min`, `max`, `step`, `onChange`, `onValueChange`, `disabled` | `change`, `valueChange` |
| `ScrollView` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `horizontal`, `vertical`, `showsScrollIndicator`, `onScroll`, `grid`, `numColumns` | `scroll` |
| `ListView` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `data`, `horizontal`, `empty`, `initialCount`, `renderItem`, `keyExtractor` | — |
| `GridView` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `data`, `numColumns`, `empty`, `initialCount`, `renderItem` | — |
| `Stack` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `alignment` | — |
| `Positioned` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `top`, `right`, `bottom`, `left` | — |
| `Spacer` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `size` | — |
| `Divider` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `color`, `thickness`, `vertical`, `inset` | — |
| `ActivityIndicator` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `size`, `color` | — |
| `SafeArea` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `edges` | — |
| `AnimatedView` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `animate`, `duration` | — |
| `CustomPaint` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `draw`, `width`, `height` | — |
| `Modal` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `visible`, `onClose`, `transparent`, `animationType` | `close` |
| `BottomSheet` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `visible`, `onClose`, `height` | `close` |
| `Dialog` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `visible`, `title`, `onClose`, `onConfirm`, `confirmText`, `cancelText` | `close`, `confirm` |
| `NavBar` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `children`, `title`, `subtitle`, `onBack`, `showBack`, `safeArea`, `reserveRight` | `back`, `press` |
| `TabBar` | `key`, `ref`, `style`, `children`, `testID`, `accessibleLabel`, `pointerEvents`, `tabs`, `activeKey`, `activeIndex`, `onChange`, `safeArea` | `change` |

## Events

`press`, `longPress`, `change`, `input`, `submit`, `valueChange`, `scroll`, `refresh`, `focus`, `blur`, `select`, `close`, `confirm`, `back`

| Prop | Event |
| --- | --- |
| `onPress` | `press` |
| `onClose` | `close` |
| `onConfirm` | `confirm` |
| `onBack` | `back` |
| `onLongPress` | `longPress` |
| `onChange` | `change` |
| `onCheckedChange` | `change` |
| `onInput` | `input` |
| `onSubmit` | `submit` |
| `onValueChange` | `valueChange` |
| `onValueChangeEnd` | `valueChange` |
| `onScroll` | `scroll` |
| `onRefresh` | `refresh` |
| `onFocus` | `focus` |
| `onBlur` | `blur` |
| `onSelect` | `select` |

## Style keys

| Key | Type |
| --- | --- |
| `width` | `number | string` |
| `height` | `number | string` |
| `minWidth` | `number` |
| `minHeight` | `number` |
| `maxWidth` | `number` |
| `maxHeight` | `number` |
| `padding` | `number` |
| `paddingHorizontal` | `number` |
| `paddingVertical` | `number` |
| `paddingTop` | `number` |
| `paddingRight` | `number` |
| `paddingBottom` | `number` |
| `paddingLeft` | `number` |
| `margin` | `number` |
| `marginHorizontal` | `number` |
| `marginVertical` | `number` |
| `marginTop` | `number` |
| `marginRight` | `number` |
| `marginBottom` | `number` |
| `marginLeft` | `number` |
| `gap` | `number` |
| `rowGap` | `number` |
| `columnGap` | `number` |
| `flex` | `number` |
| `flexGrow` | `number` |
| `flexShrink` | `number` |
| `flexBasis` | `number | string` |
| `flexDirection` | `FlexDirection` |
| `flexWrap` | `FlexWrap` |
| `alignItems` | `AlignItems` |
| `justifyContent` | `JustifyContent` |
| `alignSelf` | `AlignSelf` |
| `alignContent` | `JustifyContent` |
| `position` | `Position` |
| `top` | `number` |
| `right` | `number` |
| `bottom` | `number` |
| `left` | `number` |
| `zIndex` | `number` |
| `overflow` | `Overflow` |
| `aspectRatio` | `number` |
| `backgroundColor` | `string` |
| `color` | `string` |
| `opacity` | `number` |
| `borderRadius` | `number` |
| `borderTopLeftRadius` | `number` |
| `borderTopRightRadius` | `number` |
| `borderBottomLeftRadius` | `number` |
| `borderBottomRightRadius` | `number` |
| `borderWidth` | `number` |
| `borderColor` | `string` |
| `borderTopWidth` | `number` |
| `borderTopColor` | `string` |
| `borderRightWidth` | `number` |
| `borderRightColor` | `string` |
| `borderBottomWidth` | `number` |
| `borderBottomColor` | `string` |
| `borderLeftWidth` | `number` |
| `borderLeftColor` | `string` |
| `fontSize` | `number` |
| `fontWeight` | `FontWeight` |
| `fontStyle` | `FontStyle` |
| `fontFamily` | `string` |
| `lineHeight` | `number` |
| `letterSpacing` | `number` |
| `textAlign` | `TextAlign` |
| `textDecoration` | `TextDecoration` |
| `textTransform` | `TextTransform` |
| `numberOfLines` | `number` |
| `shadow` | `boolean` |
| `boxShadow` | `BoxShadow | BoxShadow[]` |
| `elevation` | `number` |
| `gradient` | `QappGradient` |
| `rotate` | `number` |
| `scale` | `number` |
| `translateX` | `number` |
| `translateY` | `number` |

## Style enums

- `flexDirection`: `row`, `column`, `row-reverse`, `column-reverse`
- `flexWrap`: `nowrap`, `wrap` (aliases: `no-wrap`→`nowrap`)
- `alignItems`: `start`, `end`, `center`, `stretch`, `baseline` (aliases: `flex-start`→`start`, `flex-end`→`end`)
- `justifyContent`: `start`, `end`, `center`, `spaceBetween`, `spaceAround`, `spaceEvenly` (aliases: `flex-start`→`start`, `flex-end`→`end`, `space-between`→`spaceBetween`, `space-around`→`spaceAround`, `space-evenly`→`spaceEvenly`)
- `alignSelf`: `auto`, `start`, `end`, `center`, `stretch`, `baseline` (aliases: `flex-start`→`start`, `flex-end`→`end`)
- `position`: `relative`, `absolute`
- `overflow`: `visible`, `hidden`, `clip`
- `fontWeight`: `normal`, `bold`, `100`, `200`, `300`, `400`, `500`, `600`, `700`, `800`, `900`
- `fontStyle`: `normal`, `italic`
- `textAlign`: `left`, `right`, `center`, `justify` (aliases: `start`→`left`, `end`→`right`)
- `textDecoration`: `none`, `underline`, `lineThrough` (aliases: `line-through`→`lineThrough`)
- `textTransform`: `none`, `uppercase`, `lowercase`, `capitalize`
- `stackAlignment`: `topLeft`, `topCenter`, `topRight`, `centerLeft`, `center`, `centerRight`, `bottomLeft`, `bottomCenter`, `bottomRight`
- `imageFit`: `cover`, `contain`, `fill`, `fitWidth`, `fitHeight` (aliases: `cover-fill`→`cover`)
- `animate`: `fadeIn`, `slideUp`, `scaleIn`
- `keyboardType`: `text`, `number`, `email`, `phone`, `url`
- `buttonVariant`: `primary`, `secondary`, `outline`, `text`, `danger`
- `controlSize`: `sm`, `md`, `lg` (aliases: `small`→`sm`, `medium`→`md`, `large`→`lg`)
- `tagTone`: `neutral`, `success`, `warning`, `danger`, `info` (aliases: `default`→`neutral`, `error`→`danger`)
- `avatarShape`: `circle`, `rounded` (aliases: `square`→`rounded`)
- `safeAreaEdge`: `top`, `right`, `bottom`, `left`
- `modalAnimation`: `none`, `fade`, `slide`
- `toastIcon`: `success`, `error`, `none`
- `gradientType`: `linear`, `radial`

## Permissions

| Permission | APIs |
| --- | --- |
| `toast` | `showToast` |
| `user.profile` | `getUserInfo`, `request:/users/me`, `request:/friends` |
| `media.choose` | `chooseImage` |
| `share` | `share` |
| `storage` | `getStorage`, `setStorage`, `removeStorage` |
| `qchat.api` | `request:/conversations` |
| `network` | `fetch` |

## Host methods

| Method | Permission |
| --- | --- |
| `getAppInfo` | — |
| `getSystemInfo` | — |
| `getUserInfo` | `user.profile` |
| `showToast` | `toast` |
| `chooseImage` | `media.choose` |
| `share` | `share` |
| `navigateTo` | — |
| `navigateBack` | — |
| `closeMiniApp` | — |
| `getStorage` | `storage` |
| `setStorage` | `storage` |
| `removeStorage` | `storage` |
| `request` | `qchat.api` |
| `fetch` | `network` |
| `clipboard.write` | `clipboard` |
| `clipboard.read` | `clipboard` |
| `haptic` | `haptic` |
| `setTimeout` | — |
| `clearTimeout` | — |
| `setInterval` | — |
| `clearInterval` | — |
| `requestAnimationFrame` | — |
