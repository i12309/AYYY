# Local OCR assets

- `tesseract.js@7.0.0` and `tesseract.js-core@7.0.0` are from their published npm packages. Only the browser client, worker and the three LSTM cores are included.
- English and Russian models come from `tesseract-ocr/tessdata_fast` 4.1.0, commit `65727574dfcd264acbb0c3e07860e4e9e9b22185`. The original binary models are gzip-compressed with a zero timestamp.
- The package licenses are in this directory. HUMAN loads only these local files at runtime.

SHA-256 of shipped assets

```text
f22e6d9b2804c62b69c5d2afd9007724469ded1c523f939be743bf829fcf9c6d  eng.traineddata.gz
c6596eb7be8581c18be736c846fb9173b69eccf6ef94c5135893ec56bd92ba08  LICENSE-core
cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30  LICENSE-models
b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1  LICENSE-tesseract-js.md
aba5ad36f83aa102cda23b8d7fb6682ce976da34796f91787a3e490727a8372d  rus.traineddata.gz
eef5f8b2f8e20e150680b20adaec4a60babafee3adbe8a94583c81fee46e8680  tesseract-core-lstm.wasm.js
861a536cf9ef8e63cb644d57bab39c388f37f7d6b6f60024b741c5f6b39a59b3  tesseract-core-relaxedsimd-lstm.wasm.js
c58b46a4c796c0b8afccf77591d5b875b6896b45d402bbce8caa6f5362447b38  tesseract-core-simd-lstm.wasm.js
000c27d9cd0def655f77b36c72a389c0ab13793aa31cb4d7aab56d09c0afbc7e  tesseract.min.js
cdf963ced7d25a0f98901a547647b4d6e2dbe0197fd78c87a059a87b0e542fe2  tesseract.min.js.LICENSE.txt
576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d  worker.min.js
45f54171aeaa1d10c0c1a66f374b7bba1f02472b1487fbe892eec04f840002ac  worker.min.js.LICENSE.txt
```
