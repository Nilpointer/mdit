# Local Image Test

This file checks how the preview shows images stored next to the Markdown file.
Open it from disk (not as an unsaved document) so relative paths can resolve.

## Relative path

![Sample image (relative)](images/sample.png)

## Relative path with `./`

![Sample image (dot-relative)](./images/sample.png)

## Parent-relative path with `../`

![Sample image (parent-relative)](../testdata/images/sample.png)

## Missing image

This one should show as a broken image:

![Missing image](images/does-not-exist.png)

## Remote image (for comparison)

![Go gopher](https://go.dev/images/gophers/ladder.svg)
