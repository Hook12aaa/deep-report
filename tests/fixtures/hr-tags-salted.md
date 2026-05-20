# Raw HR tags adjacent to headings

This fixture simulates a synthesizer drift where the model emitted raw `<hr>` HTML adjacent to headings. The sanitiser must strip them.

<hr>

## Section A

Body for section A with enough text to clear the density floor on this page.

<hr/>

## Section B

Body for section B with enough text to clear the density floor on this page.

## Section C
<hr>

Body for section C right after a stripped `<hr>` that sat between heading and prose. The renderer should produce no `<hr>` in the output.
