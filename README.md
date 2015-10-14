# Microdraw

Microdraw is a collaborative vectorial annotation tool for ultra
high resolution data, such as that produced by high-throughput histology.

Data visualisation uses OpenSeadragon, and data annotation uses Paper.js.

## Version 0.1
- This is the old version, that is currently running on imedv02
- Has a tag v0.1master / v0.1admin in git that can be used

## Version 0.2 (in development)
- new features:
    - Fully support hdf5 and dzi files
    - can load several slices using one json file and add annotations to each of
      the slices
    - The annotation overlay has now always the same size as the image
    - Added functionality to load annotations from an other user (experimental -
      not fully stable yet)
    - clicking the fill of an annotation will also select it now

- Breaking changes:
    - All json files need to have an array with an name of the dzi source. 
    - See examples/test.json for an example how to load several sources in one
      json
    - The annotations made with the old version will not load anymore, because
      1. the size of the annotation canvas changed and 
      2. the path with that the image is identified in the database is changed
         from the json/path to json/path@dzi-name (dzi-name is the name
         specified in the name array in the json file)
    - CAUTION: the coordinates saved in the DB now directly coorespond to
      coordinates in the image (pixel coordinate system)
- On Admin Banch: can load masks and predictions overlays for each image
