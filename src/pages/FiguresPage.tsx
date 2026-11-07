import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader.tsx'
import { Mark } from '../components/Mark.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'

const FIGURES = [
  {
    id: 'clean',
    src: '/figures/eeg-clean.png',
    file: 'eeg-clean.png',
    title: 'Figure 1. Cleaner EEG example',
    alt: 'Ten EEG traces in a dark browser window. Readable channel labels are Fc5, Fc3, Fc1, Fcz, Fc2, Fc4, and Fc6. A scale reads 97.57 microvolts. The window covers about five seconds and a scrollbar runs from 0 to 60 seconds.',
    caption:
      'Ten traces are visible. The labels that can be read are Fc5, Fc3, Fc1, Fcz, Fc2, Fc4, and Fc6. Three lower labels are cut off at the edge of the image. A scale beside the top trace reads 97.57 µV. The plotting window is marked from 0 to about 5 seconds, and the scrollbar covers 0 to 60 seconds. A Help control is part of the screenshot, so this is a picture of a viewer rather than a bare exported waveform.',
  },
  {
    id: 'noisy',
    src: '/figures/eeg-noisy.jpg',
    file: 'eeg-noisy.jpg',
    title: 'Figure 2. Noisier EEG example',
    alt: 'EEG traces dominated by sharp spikes. Readable labels are Fc5, Fc3, Fc1, Fcz, and Fc2. A scale reads 40.0 microvolts. A cyan numeral 10 is near the top. The scrollbar runs from 0 to 60 seconds.',
    caption:
      'The traces are dominated by sharp, closely spaced spikes. Labels that can be read are Fc5, Fc3, Fc1, Fcz, and Fc2. The scale reads 40.0 µV. Because that scale differs from Figure 1, the height of the traces cannot be compared by eye. The scrollbar covers 0 to 60 seconds. A cyan numeral 10 is visible near the top. The image does not explain that numeral.',
  },
  {
    id: 'psd',
    src: '/figures/eeg-psd.png',
    file: 'eeg-psd.png',
    title: 'Figure 3. Power spectrum',
    alt: 'Line plot titled EEG. Frequency axis from 0 to 40 hertz. Power axis in decibels per hertz relative to 1 microvolt squared. Many overlapping traces fall as frequency rises. One lighter trace separates from the darker cluster in places. No legend is printed.',
    caption:
      'The title printed on the figure is EEG. The horizontal axis is Frequency (Hz), marked from 0 to 40. The vertical axis is Power (dB/Hz re 1 µV²). Many traces are overlaid. They are generally higher at low frequencies and lower toward 40 Hz. One lighter trace separates from the darker cluster in parts of the plot. No legend is printed, so the traces cannot be assigned to channels or conditions from this image. The feature table does not state that its columns were computed from this spectrum.',
  },
] as const

type FigureId = (typeof FIGURES)[number]['id']

export function FiguresPage() {
  usePageTitle('Figures')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [openId, setOpenId] = useState<FigureId | null>(null)
  const openFigure = FIGURES.find((figure) => figure.id === openId) ?? null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (openId && !dialog.open) dialog.showModal()
    if (!openId && dialog.open) dialog.close()
  }, [openId])

  return (
    <>
      <PageHeader eyebrow="Figures" title="The three images supplied with the project">
        <p>
          <Mark kind="recorded" /> These are the original screenshots. Nothing has been redrawn,
          filtered, or traced. Captions describe what is visible in the image and do not add a
          recording protocol.
        </p>
      </PageHeader>

      {FIGURES.map((figure) => (
        <figure className="figure-block" key={figure.id}>
          <div className="chart-bar">
            <h2>{figure.title}</h2>
            <div className="tools">
              <button type="button" onClick={() => setOpenId(figure.id)}>
                Open larger
              </button>
              <a className="button" href={figure.src} download={figure.file}>
                Download image
              </a>
            </div>
          </div>
          <img src={figure.src} alt={figure.alt} />
          <figcaption>{figure.caption}</figcaption>
        </figure>
      ))}

      <section className="block">
        <h2>What the screenshots suggest, and what they do not prove</h2>
        <p>
          The Help button, microvolt scale, channel labels, and time scrollbar resemble the
          MNE-Python raw browser. That is a reading of the screenshot. The script that saved the
          image was not included, so the software is not treated as a recorded method.
        </p>
        <p>
          The readable names, Fc5 through Fc6 and the neighboring sites, are frontal and central
          positions in the 10-10 system. The full montage is not in the file. Figure 1 and Figure
          2 are separate images. The materials do not say they are the same recording, the same
          person, or the source of features.csv.
        </p>
      </section>

      <dialog
        ref={dialogRef}
        onClose={() => setOpenId(null)}
        aria-label={openFigure ? openFigure.title : 'Figure'}
      >
        {openFigure && (
          <>
            <div className="chart-bar">
              <h2>{openFigure.title}</h2>
              <div className="tools">
                <a className="button" href={openFigure.src} download={openFigure.file}>
                  Download image
                </a>
                <button type="button" onClick={() => setOpenId(null)}>
                  Close
                </button>
              </div>
            </div>
            <img src={openFigure.src} alt={openFigure.alt} />
            <p>{openFigure.caption}</p>
          </>
        )}
      </dialog>
    </>
  )
}
