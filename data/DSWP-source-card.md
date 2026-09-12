---
license: cc-by-4.0
task_categories:
- audio-to-audio
tags:
- bioacoustics
- sperm-whale
- marine-biology
- arxiv:2512.02206
- Project-CETI/wham
pretty_name: Dominica Sperm Whale Project (DSWP)
size_categories:
- 1K<n<10K
---
# Dominica Sperm Whale Project (DSWP) dataset
[![Code](https://img.shields.io/badge/GitHub-Project--CETI%2Fwham-blue?logo=github)](https://github.com/Project-CETI/wham)
[![Paper](https://img.shields.io/badge/arXiv-2512.02206-b31b1b.svg)](https://arxiv.org/abs/2512.02206)

This dataset contains 1,501 sperm whale codas (~45 minutes of audio) recorded off the coast of Dominica. Each audio file contains at least one coda extracted from longer recordings collected by the [Dominica Sperm Whale Project](https://www.thespermwhaleproject.org/) using a combination of far-field boat-based hydrophones and animal-borne acoustic tags.

This dataset accompanies our paper:
- _[WhAM: Towards A Translative Model of Sperm Whale Vocalization (NeurIPS 2025)](https://arxiv.org/abs/2512.02206)_

General background about codas can be found in Appendix B therein.

### Data Collection
Codas were collected between 2005 and 2018 during field seasons in a ~2000 km² area off the coast of Dominica. Recordings were obtained using several passive, non-invasive recording systems over the years, including towed hydrophones and animal-borne tags. Specifically:
- Towed Hydrophones: Benthos AQ-4 elements, 0.1–30 kHz response, with high-pass filter boxes (flat response 2--20 kHz). These were connected to either a Fostex VF-160 multitrack recorder (44.1 kHz) or a computer-based system running IFAW’s LOGGER or PAMGUARD (min. 48 kHz).
- Portable Recorders: A Zoom H4 field recorder (48 kHz) with a Cetacean Research Technology C55 hydrophone (0.02--44 kHz).
- Whale-borne tag: DTag generation 3 sound and movement tags (_Johnson & Tyack 2003_).

### Intended use and limitations
This dataset could be used for a variety of audio tasks, including e.g. analysis of sperm whale coda structure, machine learning for audio representation, or comparative studies of animal communication signals. Limitations are that codas are presented as isolated snippets without behavioral context, there is no per-file metadata (e.g. which recording system was used), and that all recordings came from the same vocal clan and geographic region.

### License and citation
This dataset is released under the Creative Commons Attribution 4.0 International (CC BY 4.0) license. If you use this dataset, please cite the associated paper:
```bibtex
@inproceedings{wham2025,
title={Towards A Translative Model of Sperm Whale Vocalization},
author={Orr Paradise, Pranav Muralikrishnan, Liangyuan Chen, Hugo Flores Garcia, Bryan Pardo, Roee Diamant, David F. Gruber, Shane Gero, Shafi Goldwasser},
booktitle={Advances in Neural Information Processing Systems 39: Annual Conference
on Neural Information Processing Systems 2025, NeurIPS 2025, San Diego, CA, USA},
year={2025}
}
```
