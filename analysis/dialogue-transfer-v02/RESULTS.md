# Dialogue Transfer v0.2 — all prespecified results

Derived only from the saved fixed report; no new fitting. All endpoints completed. Gain is paired loss(self) minus loss(recent), with the other two core contrasts retained. Duration/gap use squared natural-log units; count uses Poisson deviance. These units are not bits and cannot be compared by subtraction across endpoints or versions.

## PRIMARY: duration

723 codas / 19 roots; ridge; completed. Mean losses and MAE are evaluated on identical cases for every model below.

| Model | Pooled loss | Macro loss | Pooled MAE | Macro MAE |
| --- | ---: | ---: | ---: | ---: |
| M0 | 0.29239155 | 0.37677526 | 0.45787802 | 0.52132810 |
| M1 | 0.03893078 | 0.02984204 | 0.12927321 | 0.12368549 |
| M2 | 0.03561367 | 0.02905595 | 0.12635527 | 0.12445338 |
| M2-lagged | 0.03710603 | 0.02949645 | 0.12910855 | 0.12500325 |

| Contrast | Pooled gain | 95% pooled interval | Macro gain | 95% macro interval |
| --- | ---: | --- | ---: | --- |
| M2_vs_M1 | +0.00331711 | [+0.00049893, +0.00566578] | +0.00078608 | [-0.00134976, +0.00298342] |
| M2-lagged_vs_M1 | +0.00182474 | [-0.00034777, +0.00336907] | +0.00034558 | [-0.00199079, +0.00237541] |
| M2_vs_M2-lagged | +0.00149237 | [-0.00029573, +0.00266795] | +0.00044050 | [-0.00091969, +0.00186225] |

All per-root contributions and fixed-prediction deletion estimates for the recent-vs-self contrast follow. Other contrasts, every model's root losses/MAE and full deletion summaries are retained in [the report](results/report.json). A deletion does not refit any model or provide new held-out validation.

| Root | n | Root gain | Pooled contribution | Macro contribution | Pooled after deletion | Macro after deletion |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| sw061b | 168 | +0.00891709 | +0.00207202 | +0.00046932 | +0.00162198 | +0.00033436 |
| sw078a | 32 | +0.00024147 | +0.00001069 | +0.00001271 | +0.00345954 | +0.00081634 |
| sw078c | 2 | +0.00257476 | +0.00000712 | +0.00013551 | +0.00331917 | +0.00068671 |
| sw085a | 127 | +0.00285178 | +0.00050093 | +0.00015009 | +0.00341627 | +0.00067132 |
| sw090a | 63 | +0.00282524 | +0.00024618 | +0.00014870 | +0.00336406 | +0.00067279 |
| sw090b | 80 | +0.00368359 | +0.00040759 | +0.00019387 | +0.00327151 | +0.00062511 |
| sw091a | 35 | +0.00077952 | +0.00003774 | +0.00004103 | +0.00344620 | +0.00078645 |
| sw091b | 33 | +0.00099832 | +0.00004557 | +0.00005254 | +0.00342801 | +0.00077429 |
| sw097a | 10 | +0.00225290 | +0.00003116 | +0.00011857 | +0.00333204 | +0.00070459 |
| sw100a | 15 | -0.00568985 | -0.00011805 | -0.00029947 | +0.00350794 | +0.00114586 |
| sw100b | 2 | -0.00538450 | -0.00001489 | -0.00028339 | +0.00334125 | +0.00112889 |
| sw106a | 18 | +0.00145608 | +0.00003625 | +0.00007664 | +0.00336463 | +0.00074886 |
| sw106b | 18 | -0.00464874 | -0.00011574 | -0.00024467 | +0.00352049 | +0.00108802 |
| sw114b | 9 | -0.00511871 | -0.00006372 | -0.00026941 | +0.00342344 | +0.00111413 |
| sw115b | 13 | +0.01112491 | +0.00020003 | +0.00058552 | +0.00317415 | +0.00021170 |
| sw119a | 12 | -0.00033863 | -0.00000562 | -0.00001782 | +0.00337881 | +0.00084857 |
| sw133a | 16 | -0.00711779 | -0.00015752 | -0.00037462 | +0.00355326 | +0.00122518 |
| sw133b | 56 | +0.00155469 | +0.00012042 | +0.00008183 | +0.00346508 | +0.00074338 |
| sw134a | 14 | +0.00397342 | +0.00007694 | +0.00020913 | +0.00330415 | +0.00060901 |

Every prespecified prefix-only stratum, including its case/root support:

| Partition / cell | n | Roots | Pooled recent-vs-self | Macro recent-vs-self | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| previous / present | 712 | 19 | +0.00309236 | +0.00046239 | descriptive |
| previous / absent | 11 | 9 | +0.01786452 | +0.01053374 | descriptive |
| overlap / definite | 217 | 17 | +0.00397849 | +0.00216792 | descriptive |
| overlap / no-definite-overlap | 506 | 19 | +0.00303348 | +0.00018592 | descriptive |
| age / at-or-below | 361 | 19 | +0.00184599 | +0.00066513 | descriptive |
| age / above | 362 | 19 | +0.00478416 | +0.00072401 | descriptive |

| Fold | Training / held out | Training-only latest-partner-age median, s |
| --- | --- | ---: |
| 1 | 461 / 262 | 3.35716110 |
| 2 | 622 / 101 | 3.54473760 |
| 3 | 614 / 109 | 3.54615005 |
| 4 | 563 / 160 | 3.61128630 |
| 5 | 632 / 91 | 3.41044790 |

## SECONDARY: count

723 codas / 19 roots; poisson; completed. Mean losses and MAE are evaluated on identical cases for every model below.

| Model | Pooled loss | Macro loss | Pooled MAE | Macro MAE |
| --- | ---: | ---: | ---: | ---: |
| M0 | 1.39056474 | 1.45626442 | 1.73583707 | 1.72030148 |
| M1 | 0.61131938 | 0.58744928 | 0.95058416 | 0.88475134 |
| M2 | 0.62087264 | 0.60272164 | 0.98947806 | 0.94630879 |
| M2-lagged | 0.62837787 | 0.59914299 | 1.02783835 | 0.93437092 |

| Contrast | Pooled gain | 95% pooled interval | Macro gain | 95% macro interval |
| --- | ---: | --- | ---: | --- |
| M2_vs_M1 | -0.00955325 | [-0.02351281, +0.00290169] | -0.01527236 | [-0.02538069, -0.00540276] |
| M2-lagged_vs_M1 | -0.01705849 | [-0.04823518, +0.01687175] | -0.01169371 | [-0.03032434, +0.00818392] |
| M2_vs_M2-lagged | +0.00750524 | [-0.01991564, +0.02903577] | -0.00357865 | [-0.01659146, +0.00985780] |

All per-root contributions and fixed-prediction deletion estimates for the recent-vs-self contrast follow. Other contrasts, every model's root losses/MAE and full deletion summaries are retained in [the report](results/report.json). A deletion does not refit any model or provide new held-out validation.

| Root | n | Root gain | Pooled contribution | Macro contribution | Pooled after deletion | Macro after deletion |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| sw061b | 168 | +0.01242132 | +0.00288628 | +0.00065375 | -0.01620502 | -0.01681090 |
| sw078a | 32 | -0.01836205 | -0.00081270 | -0.00096642 | -0.00914532 | -0.01510071 |
| sw078c | 2 | -0.01938001 | -0.00005361 | -0.00102000 | -0.00952600 | -0.01504416 |
| sw085a | 127 | -0.02457534 | -0.00431683 | -0.00129344 | -0.00635224 | -0.01475553 |
| sw090a | 63 | -0.01547273 | -0.00134825 | -0.00081435 | -0.00898821 | -0.01526123 |
| sw090b | 80 | -0.01748456 | -0.00193467 | -0.00092024 | -0.00856647 | -0.01514946 |
| sw091a | 35 | -0.05234118 | -0.00253381 | -0.00275480 | -0.00737654 | -0.01321298 |
| sw091b | 33 | -0.00014682 | -0.00000670 | -0.00000773 | -0.01000313 | -0.01611267 |
| sw097a | 10 | +0.00188297 | +0.00002604 | +0.00009910 | -0.00971365 | -0.01622544 |
| sw100a | 15 | -0.00365227 | -0.00007577 | -0.00019222 | -0.00967828 | -0.01591792 |
| sw100b | 2 | -0.02575999 | -0.00007126 | -0.00135579 | -0.00950830 | -0.01468972 |
| sw106a | 18 | -0.07167939 | -0.00178455 | -0.00377260 | -0.00796706 | -0.01213864 |
| sw106b | 18 | -0.01268512 | -0.00031581 | -0.00066764 | -0.00947329 | -0.01541610 |
| sw114b | 9 | -0.00130317 | -0.00001622 | -0.00006859 | -0.00965725 | -0.01604843 |
| sw115b | 13 | -0.04036500 | -0.00072579 | -0.00212447 | -0.00898910 | -0.01387833 |
| sw119a | 12 | -0.00524571 | -0.00008707 | -0.00027609 | -0.00962596 | -0.01582940 |
| sw133a | 16 | +0.00304041 | +0.00006728 | +0.00016002 | -0.00983826 | -0.01628974 |
| sw133b | 56 | +0.02637383 | +0.00204279 | +0.00138810 | -0.01256962 | -0.01758604 |
| sw134a | 14 | -0.02544005 | -0.00049262 | -0.00133895 | -0.00923955 | -0.01470749 |

Every prespecified prefix-only stratum, including its case/root support:

| Partition / cell | n | Roots | Pooled recent-vs-self | Macro recent-vs-self | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| previous / present | 712 | 19 | -0.00994708 | -0.01684242 | descriptive |
| previous / absent | 11 | 9 | +0.01593795 | +0.02845801 | descriptive |
| overlap / definite | 217 | 17 | +0.00780903 | -0.01634859 | descriptive |
| overlap / no-definite-overlap | 506 | 19 | -0.01699914 | -0.00859031 | descriptive |
| age / at-or-below | 361 | 19 | +0.00476340 | -0.02045870 | descriptive |
| age / above | 362 | 19 | -0.02383036 | -0.02011967 | descriptive |

| Fold | Training / held out | Training-only latest-partner-age median, s |
| --- | --- | ---: |
| 1 | 461 / 262 | 3.35716110 |
| 2 | 622 / 101 | 3.54473760 |
| 3 | 614 / 109 | 3.54615005 |
| 4 | 563 / 160 | 3.61128630 |
| 5 | 632 / 91 | 3.41044790 |

## SECONDARY: gap

723 codas / 19 roots; ridge; completed. Mean losses and MAE are evaluated on identical cases for every model below.

| Model | Pooled loss | Macro loss | Pooled MAE | Macro MAE |
| --- | ---: | ---: | ---: | ---: |
| M0 | 0.22693239 | 0.21306191 | 0.33996759 | 0.32940688 |
| M1 | 0.23851148 | 0.20257098 | 0.34923405 | 0.31677145 |
| M2 | 0.23723858 | 0.19384740 | 0.34931872 | 0.30891528 |
| M2-lagged | 0.24301924 | 0.20056564 | 0.35473147 | 0.31599439 |

| Contrast | Pooled gain | 95% pooled interval | Macro gain | 95% macro interval |
| --- | ---: | --- | ---: | --- |
| M2_vs_M1 | +0.00127290 | [-0.00468375, +0.00663325] | +0.00872358 | [-0.00289729, +0.02575263] |
| M2-lagged_vs_M1 | -0.00450775 | [-0.00934432, +0.00185559] | +0.00200535 | [-0.01256505, +0.02041077] |
| M2_vs_M2-lagged | +0.00578066 | [-0.00214674, +0.01165828] | +0.00671824 | [-0.00570865, +0.01758568] |

All per-root contributions and fixed-prediction deletion estimates for the recent-vs-self contrast follow. Other contrasts, every model's root losses/MAE and full deletion summaries are retained in [the report](results/report.json). A deletion does not refit any model or provide new held-out validation.

| Root | n | Root gain | Pooled contribution | Macro contribution | Pooled after deletion | Macro after deletion |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| sw061b | 168 | +0.01070180 | +0.00248673 | +0.00056325 | -0.00158125 | +0.00861368 |
| sw078a | 32 | +0.00071405 | +0.00003160 | +0.00003758 | +0.00129878 | +0.00916856 |
| sw078c | 2 | +0.14539600 | +0.00040220 | +0.00765242 | +0.00087312 | +0.00113067 |
| sw085a | 127 | +0.00034763 | +0.00006106 | +0.00001830 | +0.00147007 | +0.00918892 |
| sw090a | 63 | -0.00319509 | -0.00027841 | -0.00016816 | +0.00169940 | +0.00938573 |
| sw090b | 80 | -0.01343371 | -0.00148644 | -0.00070704 | +0.00310265 | +0.00995455 |
| sw091a | 35 | +0.00382506 | +0.00018517 | +0.00020132 | +0.00114307 | +0.00899573 |
| sw091b | 33 | -0.00795040 | -0.00036288 | -0.00041844 | +0.00171402 | +0.00964992 |
| sw097a | 10 | +0.00864574 | +0.00011958 | +0.00045504 | +0.00116950 | +0.00872791 |
| sw100a | 15 | +0.00207534 | +0.00004306 | +0.00010923 | +0.00125590 | +0.00909293 |
| sw100b | 2 | -0.00089482 | -0.00000248 | -0.00004710 | +0.00127892 | +0.00925794 |
| sw106a | 18 | +0.01843819 | +0.00045904 | +0.00097043 | +0.00083464 | +0.00818388 |
| sw106b | 18 | -0.01401736 | -0.00034898 | -0.00073776 | +0.00166329 | +0.00998697 |
| sw114b | 9 | -0.00191661 | -0.00002386 | -0.00010087 | +0.00131311 | +0.00931471 |
| sw115b | 13 | -0.01879051 | -0.00033787 | -0.00098897 | +0.00164026 | +0.01025215 |
| sw119a | 12 | +0.04189439 | +0.00069534 | +0.00220497 | +0.00058731 | +0.00688076 |
| sw133a | 16 | +0.00142624 | +0.00003156 | +0.00007507 | +0.00126943 | +0.00912899 |
| sw133b | 56 | -0.00440620 | -0.00034128 | -0.00023191 | +0.00174971 | +0.00945302 |
| sw134a | 14 | -0.00311165 | -0.00006025 | -0.00016377 | +0.00135948 | +0.00938110 |

Every prespecified prefix-only stratum, including its case/root support:

| Partition / cell | n | Roots | Pooled recent-vs-self | Macro recent-vs-self | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| previous / present | 712 | 19 | +0.00100490 | +0.01108750 | descriptive |
| previous / absent | 11 | 9 | +0.01861994 | +0.01422998 | descriptive |
| overlap / definite | 217 | 17 | +0.00090815 | -0.00211572 | descriptive |
| overlap / no-definite-overlap | 506 | 19 | +0.00142933 | +0.00879779 | descriptive |
| age / at-or-below | 361 | 19 | +0.00043681 | +0.00352780 | descriptive |
| age / above | 362 | 19 | +0.00210669 | +0.01218224 | descriptive |

| Fold | Training / held out | Training-only latest-partner-age median, s |
| --- | --- | ---: |
| 1 | 461 / 262 | 3.35716110 |
| 2 | 622 / 101 | 3.54473760 |
| 3 | 614 / 109 | 3.54615005 |
| 4 | 563 / 160 | 3.61128630 |
| 5 | 632 / 91 | 3.41044790 |

## COVERAGE SENSITIVITY: coverage-duration

1017 codas / 20 roots; ridge; completed. Mean losses and MAE are evaluated on identical cases for every model below.

| Model | Pooled loss | Macro loss | Pooled MAE | Macro MAE |
| --- | ---: | ---: | ---: | ---: |
| M0 | 0.31289873 | 0.35506532 | 0.48507600 | 0.51283061 |
| M1 | 0.03695331 | 0.03035017 | 0.12674606 | 0.12067539 |
| M2 | 0.03443601 | 0.02991650 | 0.12353089 | 0.11937008 |

| Contrast | Pooled gain | 95% pooled interval | Macro gain | 95% macro interval |
| --- | ---: | --- | ---: | --- |
| M2_vs_M1 | +0.00251731 | [-0.00100117, +0.00481117] | +0.00043368 | [-0.00361957, +0.00331434] |

All per-root contributions and fixed-prediction deletion estimates for the recent-vs-self contrast follow. Other contrasts, every model's root losses/MAE and full deletion summaries are retained in [the report](results/report.json). A deletion does not refit any model or provide new held-out validation.

| Root | n | Root gain | Pooled contribution | Macro contribution | Pooled after deletion | Macro after deletion |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| sw061b | 201 | +0.00836030 | +0.00165233 | +0.00041802 | +0.00107804 | +0.00001649 |
| sw078a | 37 | +0.00308125 | +0.00011210 | +0.00015406 | +0.00249602 | +0.00029433 |
| sw078c | 2 | +0.00305102 | +0.00000600 | +0.00015255 | +0.00251626 | +0.00029592 |
| sw085a | 185 | +0.00324807 | +0.00059085 | +0.00016240 | +0.00235482 | +0.00028555 |
| sw090a | 96 | +0.00185247 | +0.00017486 | +0.00009262 | +0.00258661 | +0.00035900 |
| sw090b | 117 | +0.00168325 | +0.00019365 | +0.00008416 | +0.00262574 | +0.00036791 |
| sw091a | 51 | +0.00468094 | +0.00023474 | +0.00023405 | +0.00240308 | +0.00021014 |
| sw091b | 50 | +0.00153760 | +0.00007559 | +0.00007688 | +0.00256797 | +0.00037557 |
| sw097a | 21 | +0.00103931 | +0.00002146 | +0.00005197 | +0.00254847 | +0.00040180 |
| sw100a | 20 | -0.00532283 | -0.00010468 | -0.00026614 | +0.00267458 | +0.00073665 |
| sw100b | 9 | +0.00413938 | +0.00003663 | +0.00020697 | +0.00250283 | +0.00023864 |
| sw106a | 19 | -0.00198134 | -0.00003702 | -0.00009907 | +0.00260295 | +0.00056078 |
| sw106b | 22 | +0.00023375 | +0.00000506 | +0.00001169 | +0.00256780 | +0.00044420 |
| sw114b | 18 | -0.00121742 | -0.00002155 | -0.00006087 | +0.00258460 | +0.00052058 |
| sw115b | 16 | +0.01164095 | +0.00018314 | +0.00058205 | +0.00237148 | -0.00015618 |
| sw119a | 16 | +0.00049040 | +0.00000772 | +0.00002452 | +0.00254971 | +0.00043069 |
| sw119b | 11 | +0.00143678 | +0.00001554 | +0.00007184 | +0.00252912 | +0.00038088 |
| sw133a | 25 | -0.03053550 | -0.00075063 | -0.00152677 | +0.00335029 | +0.00206363 |
| sw133b | 77 | +0.00176314 | +0.00013349 | +0.00008816 | +0.00257909 | +0.00036370 |
| sw134a | 24 | -0.00050799 | -0.00001199 | -0.00002540 | +0.00259043 | +0.00048324 |

Every prespecified prefix-only stratum, including its case/root support:

| Partition / cell | n | Roots | Pooled recent-vs-self | Macro recent-vs-self | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| previous / present | 970 | 20 | +0.00233653 | +0.00018345 | descriptive |
| previous / absent | 47 | 15 | +0.00624830 | +0.00509089 | descriptive |
| overlap / definite | 305 | 18 | +0.00260609 | -0.00037387 | descriptive |
| overlap / no-definite-overlap | 712 | 20 | +0.00247928 | +0.00058441 | descriptive |
| age / at-or-below | 508 | 20 | +0.00184946 | -0.00039095 | descriptive |
| age / above | 509 | 20 | +0.00318384 | +0.00100021 | descriptive |

| Fold | Training / held out | Training-only latest-partner-age median, s |
| --- | --- | ---: |
| 1 | 674 / 343 | 3.40589570 |
| 2 | 885 / 132 | 3.56302210 |
| 3 | 866 / 151 | 3.55278125 |
| 4 | 769 / 248 | 3.61128630 |
| 5 | 874 / 143 | 3.36890835 |

## Interpretation limits

All 2,000 paired root-bootstrap draws are in the report. The three core endpoints reuse the same draws; coverage has its own 20-root plan. Intervals are pointwise, conditional and descriptive, omit model-refit uncertainty and multiplicity protection, and do not certify encounter independence. Strata are descriptive partitions, with no fitted subgroup model; the 11 core cases without previous focal history are particularly sparse despite spanning nine roots. No cell or root was selected to rescue a result. See [the decision note](../../docs/MVP_05B.md).
