/* Data Darbar brand preset.
   Drop this object in as the `brand` value of any dataset config:

     const CONFIG = {
       ...,
       brand: DATADARBAR_BRAND,     // <- use this
       ...
     };

   Or copy the fields inline. build.py injects the logo when you pass --logo,
   so leave logoDataUri as "".  Full rules: see BRAND_GUIDELINES.md. */

const DATADARBAR_BRAND = {
  primary:   "#0a4c76",   // Data Darbar primary
  secondary: "#999999",   // secondary; extra series = monochromes of these two
  posColor:  "#1a7f4b",   // increase (green)
  negColor:  "#c0392b",   // decrease (red)
  font:      "Poppins",
  logoDataUri: "",        // injected by build.py via --logo
};
