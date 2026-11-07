# VoxNeura

VoxNeura is an adaptive EEG communication interface. When signal reliability is judged to be high, the board offers more phrases. When it is moderate, the board is shorter. When it is low, the board keeps YES, NO, HELP, and RETRY.

EEG measures voltage at the scalp. It does not contain words. This application does not read thoughts, and it is not a clinical device.

## What the application is

The interface is a working communication board. High, medium, and low change the choices immediately. A separate demonstration control, labeled as confidence, does not change the number of choices. It only decides whether a selection is sent at once or waits for confirmation. The two controls can be moved independently so the difference stays visible.

The data page loads `features.csv` and calculates statistics, correlations, and charts from that file. The figures page shows the three supplied EEG images without redrawing them. The experiments page compares a fixed board with an adaptive board and stores the trials in the browser.

## What it is not

No participant count, task, classifier accuracy, or clinical outcome is reported, because none of those facts were in the supplied files. The experiment log is created when someone uses this application. It is not a reconstruction of a completed study. HELP records a word and can speak it. It does not contact emergency services.

Labels used in the interface:

- Recorded file: the CSV or an image, unchanged.
- Computed here: a statistic or chart calculated from the CSV.
- Demonstration: a rule or trial that this software defines.

## Data

`public/data/features.csv` has the header `theta,alpha,beta,variability,mean_amp` and 64 data rows. The file does not state units, sampling rate, window length, reference, montage, subject, or class label. Values are shown as stored.

SHA-256 of the file text:

`8613d4b390b7ae3769f8d957c7eda4827a7688f6fa57937afdad122fb5395110`

The data page recomputes that hash from the file it loaded.

The column names theta, alpha, and beta match the usual names of EEG bands, often about 4 to 7 Hz, 8 to 12 Hz, and 13 to 30 Hz. That is context for the names. It is not a record of how these columns were computed.

Band shares, shown on the data page, are each band divided by the sum of the three band columns in that row. They are not columns in the file.

## Figures

| File | What it is |
| --- | --- |
| `public/figures/eeg-clean.png` | Cleaner multichannel time series. Scale reads 97.57 µV. Scrollbar covers 0 to 60 s. |
| `public/figures/eeg-noisy.jpg` | Noisier time series, dominated by spikes. Scale reads 40.0 µV. |
| `public/figures/eeg-psd.png` | Spectrum titled EEG, 0 to 40 Hz, power in dB/Hz relative to 1 µV². |

The two time series use different scales, so their amplitudes should not be compared by eye. The screenshots include viewer controls and resemble the MNE-Python raw browser. The script that saved them was not included. The files do not say that the images and the CSV come from the same recording.

## Reliability rule

The CSV has no reliability label. The demonstration rule `variability-tertiles-v1` orders the rows by variability, lowest first. The first third is the high-reliability state, the middle third is medium, and the remaining rows are low. For 64 rows that is 21, 21, and 22. Lower variability is mapped to the larger choice set.

This is an equal-count split, not a validated index. A large variability value can be artifact or a large neural signal. The file does not say which. The rule is documented on the Reliability page, and the same function drives the interface when a row is matched.

Classifier confidence is not in the file. The slider is a demonstration. Confirmation is required when its value is below 70. At 70 or above, a choice is sent immediately.

## Boards

| State | Choices |
| --- | --- |
| Low | YES, NO, HELP, RETRY |
| Medium | those four, plus STOP, PAIN, WATER, OK |
| High | those eight, plus HUNGRY, TIRED, BATHROOM, COLD, HOT, CALL, WAIT, AGAIN |

The phrases were chosen for this demonstration. They are not a stimulus list from a published experiment. YES, NO, HELP, and RETRY stay at the front of every board, in that order.

Keys 1 through 9 select the first nine visible choices. Enter sends a waiting choice. Escape cancels it.

## Experiments

The experiments page is a demonstration task, not an EEG study.

- The target is one of YES, NO, HELP, or RETRY, each with equal chance. The draw is not seeded.
- Held high keeps reliability high. Both policies show 16 choices, so this scenario is a control.
- Step down is high until 5 seconds, medium until 10 seconds, then low.
- Held low stays low.
- Fixed always shows 16 choices. Adaptive shows 16, 8, or 4.
- A trial ends on the first selection, at 30 seconds, or when it is stopped.
- Uncheck "Record this trial" for a practice run. Practice is not written to the log.
- "Repeat with the other policy" locks the same target for the next trial.

Trials are stored in `localStorage` under `voxneura.trials.v1`. The CSV download adds a `data_source` column with the value `browser-demonstration`. Summary medians describe only those stored trials.

## Calculations

- Mean: arithmetic mean.
- Standard deviation: sample divisor n - 1.
- Quartiles: linear interpolation, Hyndman and Fan type 7.
- Correlation: Pearson r. No p-value is reported.
- Histogram: 10 equal-width bins from the minimum to the maximum.

## Technology

- React 19 and Vite, TypeScript.
- Interface type is Geist Variable, self-hosted so the app works offline, with IBM Plex Mono for numbers. Both are under the SIL Open Font License. The stack tries `pplxSans` first, so a licensed local install of Perplexity's face is used when it is present.
- Perplexity's interface face, PPLX Sans, is proprietary. Its font files are not included.
- The visual theme is black, with blue used for links, focus, and the current section.
- No server is required. The CSV and images are static files. Transcripts and trials stay in the browser.

## Run

```bash
npm install
npm test
npm run dev
npm run build
```

Open the address printed by `npm run dev`, usually `http://localhost:5173`. `npm test` checks the parser, the statistics, the reliability split on the real CSV, and the trial summary. `npm run build` typechecks and writes `dist/`.

## Limitations

- Not a medical device. No clinical validation is claimed.
- A selected word is not evidence that EEG classified an intention.
- The 64 rows are not identified as 64 participants. Neighboring rows often move together, which is visible on the charts.
- The screenshots are not the recording.
- The variability tertiles can split a narrow range into three labels.
- The confidence slider is not a model output.
- Speech depends on the browser.

Questions that the supplied files do not answer, and that this application does not guess: who was recorded, what task they performed, how the five columns were computed, whether the images match the CSV, and whether a classifier or a participant comparison was ever run.
