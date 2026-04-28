import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const PROCESSING_DELAY_MS = 1400
const RAW_BASE_URL = import.meta.env.BASE_URL ?? '/'
const BASE_URL = RAW_BASE_URL.endsWith('/') ? RAW_BASE_URL : `${RAW_BASE_URL}/`
const SPEAKERS = Array.from({ length: 10 }, (_, index) => `speaker_${index + 1}`)

const withBasePath = (relativePath) => `${BASE_URL}${relativePath.replace(/^\/+/, '')}`

const getSpeakerNumber = (speaker) => speaker.split('_')[1]

function App() {
  const [mapping, setMapping] = useState({})
  const [selectedSpeaker, setSelectedSpeaker] = useState('')
  const [selectedWord, setSelectedWord] = useState('')
  const [result, setResult] = useState(null)
  const [previousResult, setPreviousResult] = useState(null)
  const [resultVersion, setResultVersion] = useState(0)
  const [resultPulse, setResultPulse] = useState(false)
  const [error, setError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [imageLoadFailed, setImageLoadFailed] = useState(false)
  const [audioRef, setAudioRef] = useState(null)
  const [isSpeakerOpen, setIsSpeakerOpen] = useState(false)
  const [activeSpeakerIndex, setActiveSpeakerIndex] = useState(-1)
  const speakerDropdownRef = useRef(null)
  const speakerListRef = useRef(null)
  const resultPanelRef = useRef(null)
  const resultTransitionRef = useRef(null)
  const resultPulseRef = useRef(null)

  useEffect(() => {
    const loadMapping = async () => {
      try {
        const response = await fetch(withBasePath('mapping.json'))
        if (!response.ok) {
          throw new Error('Could not load local mapping.json.')
        }
        const json = await response.json()
        setMapping(json)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error while loading mapping.'
        setError(message)
      }
    }

    loadMapping()
  }, [])

  useEffect(
    () => () => {
      if (audioRef) {
        audioRef.pause()
        audioRef.currentTime = 0
      }
    },
    [audioRef],
  )

  useEffect(() => {
    return () => {
      if (resultTransitionRef.current) {
        clearTimeout(resultTransitionRef.current)
      }
      if (resultPulseRef.current) {
        clearTimeout(resultPulseRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isSpeakerOpen) {
      return
    }

    const handlePointerDown = (event) => {
      if (speakerDropdownRef.current && !speakerDropdownRef.current.contains(event.target)) {
        setIsSpeakerOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isSpeakerOpen])

  useEffect(() => {
    if (!isSpeakerOpen) {
      return
    }

    const selectedIndex = SPEAKERS.findIndex((speaker) => speaker === selectedSpeaker)
    setActiveSpeakerIndex(selectedIndex >= 0 ? selectedIndex : 0)

    if (speakerListRef.current) {
      const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches
      if (!isCoarsePointer) {
        speakerListRef.current.focus({ preventScroll: true })
      }
    }
  }, [isSpeakerOpen, selectedSpeaker])

  useEffect(() => {
    if (!result || !resultPanelRef.current) {
      return
    }

    const isMobile = window.matchMedia('(max-width: 1024px)').matches
    if (isMobile) {
      resultPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  useEffect(() => {
    if (!isGenerating || !resultPanelRef.current) {
      return
    }

    const isStackedLayout = window.matchMedia('(max-width: 1023px)').matches
    if (isStackedLayout) {
      resultPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [isGenerating])

  const words = useMemo(
    () =>
      Object.entries(mapping)
        .map(([manipuri, english]) => ({
          manipuri,
          english,
        }))
        .sort((first, second) => first.manipuri.localeCompare(second.manipuri)),
    [mapping],
  )

  const canPlayAudio = Boolean(selectedSpeaker && selectedWord && !isGenerating)
  const canGenerateImage = Boolean(selectedSpeaker && selectedWord && !isGenerating)
  const hasResult = Boolean(result)
  const showPlaceholder = !result && !isGenerating
  const showLoading = isGenerating

  const stopCurrentAudio = useCallback(() => {
    if (audioRef) {
      audioRef.pause()
      audioRef.currentTime = 0
      setAudioRef(null)
    }
    setIsPlayingAudio(false)
  }, [audioRef])

  const handleSpeakerChange = useCallback(
    (speaker) => {
      setSelectedSpeaker(speaker)
      setError('')
      setImageLoadFailed(false)
      stopCurrentAudio()
      setIsSpeakerOpen(false)
    },
    [stopCurrentAudio],
  )

  const handleWordSelect = useCallback(
    (manipuri) => {
      setSelectedWord(manipuri)
      setError('')
      setImageLoadFailed(false)
      stopCurrentAudio()
    },
    [stopCurrentAudio],
  )

  const moveSpeakerIndex = (direction) => {
    if (!SPEAKERS.length) {
      return
    }

    setActiveSpeakerIndex((current) => {
      const baseIndex = current >= 0 ? current : 0
      return (baseIndex + direction + SPEAKERS.length) % SPEAKERS.length
    })
  }

  const commitActiveSpeaker = () => {
    if (activeSpeakerIndex < 0) {
      return
    }

    const nextSpeaker = SPEAKERS[activeSpeakerIndex]
    if (nextSpeaker) {
      handleSpeakerChange(nextSpeaker)
    }
  }

  const handleSpeakerKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isSpeakerOpen) {
        setIsSpeakerOpen(true)
        return
      }
      moveSpeakerIndex(1)
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isSpeakerOpen) {
        setIsSpeakerOpen(true)
        return
      }
      moveSpeakerIndex(-1)
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!isSpeakerOpen) {
        setIsSpeakerOpen(true)
        return
      }
      commitActiveSpeaker()
    }

    if (event.key === 'Escape' && isSpeakerOpen) {
      event.preventDefault()
      setIsSpeakerOpen(false)
    }
  }

  const activeSpeakerId =
    activeSpeakerIndex >= 0 ? `speaker-option-${SPEAKERS[activeSpeakerIndex]}` : undefined

  const handlePlayAudio = async () => {
    if (!selectedSpeaker || !selectedWord) {
      setError('Please select both a speaker and a word.')
      return
    }

    setError('')

    const speakerNumber = getSpeakerNumber(selectedSpeaker)
    const audioPath = withBasePath(`audio/${selectedSpeaker}/${selectedWord}/${selectedWord}_${speakerNumber}_1.wav`)

    try {
      stopCurrentAudio()
      const audio = new Audio(audioPath)
      audio.onended = () => {
        setIsPlayingAudio(false)
        setAudioRef(null)
      }
      audio.onerror = () => {
        setIsPlayingAudio(false)
        setAudioRef(null)
        setError(`Audio file not found: ${selectedWord}_${speakerNumber}_1.wav`)
      }
      setAudioRef(audio)
      setIsPlayingAudio(true)
      await audio.play()
    } catch (playError) {
      setIsPlayingAudio(false)
      const message =
        playError instanceof Error
          ? playError.message
          : 'Audio playback failed. Please check browser autoplay/audio settings.'
      setError(message)
    }
  }

  const handleGenerateImage = async () => {
    if (!selectedSpeaker || !selectedWord) {
      setError('Please select both a speaker and a word.')
      return
    }

    const englishWord = mapping[selectedWord]
    if (!englishWord) {
      setError(`'${selectedWord}' was not found in mapping.json.`)
      return
    }

    setError('')
    setImageLoadFailed(false)
    setIsGenerating(true)

    await new Promise((resolve) => {
      setTimeout(resolve, PROCESSING_DELAY_MS)
    })

    const imageFilename = `${englishWord}.png`
    const imagePath = withBasePath(`images/${encodeURIComponent(imageFilename)}`)

    const nextResult = {
      manipuriWord: selectedWord,
      englishWord,
      speaker: selectedSpeaker,
      imagePath,
    }

    if (result) {
      setPreviousResult(result)
      if (resultTransitionRef.current) {
        clearTimeout(resultTransitionRef.current)
      }
      resultTransitionRef.current = setTimeout(() => {
        setPreviousResult(null)
      }, 320)
    }

    const imageExists = await new Promise((resolve) => {
      const preloaded = new Image()
      preloaded.onload = () => resolve(true)
      preloaded.onerror = () => resolve(false)
      preloaded.src = imagePath
    })

    setImageLoadFailed(!imageExists)
    setResult(nextResult)
    setResultVersion((value) => value + 1)
    setResultPulse(true)
    if (resultPulseRef.current) {
      clearTimeout(resultPulseRef.current)
    }
    resultPulseRef.current = setTimeout(() => {
      setResultPulse(false)
    }, 700)

    setIsGenerating(false)
  }

  const handleResultImageError = () => {
    setImageLoadFailed(true)
  }

  const speakerOptions = useMemo(
    () =>
      SPEAKERS.map((speaker, index) => {
        const isSelected = selectedSpeaker === speaker
        const isActive = activeSpeakerIndex === index

        return (
          <button
            key={speaker}
            id={`speaker-option-${speaker}`}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={`dropdown-option ${isSelected ? 'dropdown-option--selected' : ''} ${
              isActive ? 'dropdown-option--active' : ''
            }`}
            onMouseEnter={() => setActiveSpeakerIndex(index)}
            onClick={() => handleSpeakerChange(speaker)}
          >
            <span className="text-sm font-semibold text-slate-100">{speaker}</span>
          </button>
        )
      }),
    [activeSpeakerIndex, handleSpeakerChange, selectedSpeaker],
  )

  const wordButtons = useMemo(
    () =>
      words.map((entry) => {
        const isSelected = selectedWord === entry.manipuri

        return (
          <button
            key={entry.manipuri}
            type="button"
            onClick={() => handleWordSelect(entry.manipuri)}
            className={`word-card ${isSelected ? 'word-card--selected' : ''}`}
          >
            <p className="text-base font-semibold text-white">{entry.manipuri}</p>
            <p className="mt-1 text-sm text-slate-200/90">{entry.english}</p>
          </button>
        )
      }),
    [handleWordSelect, selectedWord, words],
  )

  const renderResultContent = (data, allowFallback) => {
    const isLongWord = data.manipuriWord.length > 10

    return (
      <div className="result-layer-content min-w-0 grid h-full gap-6 items-center md:gap-8 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="result-text min-w-0 flex h-full flex-col justify-center gap-7">
          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300/70">Predicted Word</p>
              <p
                className={`result-word mt-3 text-3xl font-semibold text-white md:text-4xl ${
                  isLongWord ? 'result-word--long' : ''
                }`}
              >
                {data.manipuriWord}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300/70">English Meaning</p>
              <p className="mt-3 text-base font-medium text-blue-100/85 md:text-lg">{data.englishWord}</p>
            </div>
          </div>
          <p className="text-xs text-slate-200/70">Speaker: {data.speaker}</p>
        </div>

        <div className="result-image-frame min-w-0 flex w-full min-h-[220px] items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-slate-950/30 p-2 sm:min-h-[260px] md:min-h-[320px] md:h-[380px] lg:h-[440px]">
          {allowFallback && imageLoadFailed ? (
            <div className="text-center text-sm text-amber-200">
              Image not found for expected file:
              <br />
              {`${data.englishWord}.png`}
            </div>
          ) : (
            <img
              src={data.imagePath}
              alt={`${data.englishWord} generated preview`}
              className="result-image min-w-0 h-full w-full rounded-xl object-contain shadow-[0_16px_40px_rgba(4,10,40,0.45)]"
              onError={allowFallback ? handleResultImageError : undefined}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell relative min-h-screen overflow-hidden text-slate-100">
      <div
        className="hero-backdrop pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${withBasePath('background/ui.png')}')` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-slate-950/64" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-indigo-950/35 via-slate-950/35 to-slate-950/70 bg-shift" />
      <div className="cinematic-vignette" />
      <div className="ambient-orb ambient-orb--cyan" />
      <div className="ambient-orb ambient-orb--violet" />

      <main className="reveal-fade scene-rise relative z-10 mx-auto flex min-h-screen w-full max-w-[1400px] flex-col items-center px-4 py-8 sm:py-10 md:px-8 md:py-14">
        <header className="hero-title title-block w-full text-center">
          <div className="title-spark title-spark--top" aria-hidden="true" />
          <h1 className="title-stack title-animate font-heading">
            <span className="title-line title-line--primary title-delay-1">Audio-to-Visual</span>
            <span className="title-line title-line--secondary title-line--desktop title-delay-2">
              Image Generation from Low-Resource <span className="title-line--accent">Manipuri Speech</span>
            </span>
            <span className="title-line title-line--secondary title-line--mobile title-delay-2">
              Image Generation from
            </span>
            <span className="title-line title-line--secondary title-line--mobile title-delay-3">
              Low-Resource <span className="title-line--accent">Manipuri Speech</span>
            </span>
          </h1>
          <div className="title-spark title-spark--bottom" aria-hidden="true" />
        </header>

        <div className="hero-signal reveal-up delay-1" aria-hidden="true">
          <span className="signal-bar signal-bar--1" />
          <span className="signal-bar signal-bar--2" />
          <span className="signal-bar signal-bar--3" />
          <span className="signal-bar signal-bar--4" />
          <span className="signal-bar signal-bar--5" />
        </div>

        <section className="mt-5 w-full max-w-[1400px] md:mt-7">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
            <div className="glass-panel upload-panel reveal-up delay-3 min-w-0 w-full rounded-[30px] px-6 py-8 md:px-8 md:py-8 lg:px-10 lg:py-10">
              <div className="mx-auto w-full">
                <div className="grid gap-4 grid-cols-1 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                    <label id="speaker-label" className="font-heading text-lg font-semibold text-white">
                      Select Speaker
                    </label>
                    <div
                      ref={speakerDropdownRef}
                      className={`dropdown-shell mt-3 ${isSpeakerOpen ? 'dropdown-shell--open' : ''}`}
                    >
                      <button
                        id="speaker-trigger"
                        type="button"
                        className="dropdown-trigger"
                        aria-haspopup="listbox"
                        aria-expanded={isSpeakerOpen}
                        aria-controls="speaker-listbox"
                        aria-labelledby="speaker-label speaker-trigger"
                        onClick={() => setIsSpeakerOpen((open) => !open)}
                        onKeyDown={handleSpeakerKeyDown}
                      >
                        <span className={selectedSpeaker ? 'text-white' : 'text-slate-300/80'}>
                          {selectedSpeaker || 'Choose speaker'}
                        </span>
                        <span className={`dropdown-chevron ${isSpeakerOpen ? 'dropdown-chevron--open' : ''}`}>
                          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                            <path
                              d="M5 7.5L10 12.5L15 7.5"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </button>

                      <div
                        id="speaker-listbox"
                        ref={speakerListRef}
                        role="listbox"
                        tabIndex={-1}
                        aria-activedescendant={activeSpeakerId}
                        className={`dropdown-panel ${isSpeakerOpen ? 'dropdown-panel--open' : ''}`}
                        onKeyDown={handleSpeakerKeyDown}
                      >
                        {speakerOptions}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <button
                        type="button"
                        onClick={handlePlayAudio}
                        disabled={!canPlayAudio}
                        className="w-full rounded-xl border border-cyan-200/40 bg-cyan-400/15 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {isPlayingAudio ? 'Playing...' : 'Play Audio'}
                      </button>

                      <button
                        type="button"
                        onClick={handleGenerateImage}
                        disabled={!canGenerateImage}
                        className={`action-button ${isGenerating ? 'action-button--busy' : ''} w-full rounded-xl bg-gradient-to-b from-blue-400 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(56,118,255,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:from-blue-300 hover:to-blue-500 hover:shadow-[0_12px_36px_rgba(56,118,255,0.55)] disabled:cursor-not-allowed disabled:opacity-45`}
                      >
                        {isGenerating ? 'Generating...' : 'Generate Image'}
                      </button>
                    </div>

                    {selectedSpeaker && (
                      <p className="mt-4 text-xs text-slate-200/90">Selected speaker: {selectedSpeaker}</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                    <h2 className="font-heading text-xl font-semibold text-white">Select Manipuri Word</h2>
                    <div className="word-list mt-4 flex h-[280px] flex-col gap-3 overflow-y-auto pr-2 pb-1 sm:h-[340px] md:h-[420px] lg:h-[440px]">
                      {wordButtons}
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="status-chip status-chip--error mx-auto mt-6 max-w-md rounded-xl border border-rose-200/35 bg-rose-300/15 px-4 py-3 text-center text-sm text-rose-100">
                  {error}
                </div>
              )}
            </div>

            <div className="result-panel-wrapper min-w-0 w-full">
              <aside
                ref={resultPanelRef}
                className={`result-panel reveal-up delay-3 min-w-0 h-[320px] w-full rounded-[30px] px-4 py-5 sm:h-[360px] sm:px-5 md:h-[440px] md:px-6 md:py-6 lg:h-[520px] ${
                  hasResult ? 'result-panel--active' : ''
                } ${resultPulse ? 'result-panel--pulse' : ''}`}
              >
                <div className="result-panel-body relative h-full">
                  {(hasResult || previousResult) && (
                    <div className="result-layer-stack h-full">
                      {previousResult && (
                        <div className="result-layer result-layer--out">
                          {renderResultContent(previousResult, false)}
                        </div>
                      )}
                      {hasResult && (
                        <div key={`result-${resultVersion}`} className="result-layer result-layer--in">
                          {renderResultContent(result, true)}
                        </div>
                      )}
                    </div>
                  )}

                  {showPlaceholder && (
                    <div className="result-state result-animate absolute inset-0 flex h-full flex-col items-center justify-center gap-2 text-center">
                      <p className="text-sm font-semibold text-slate-100">Select a word to preview</p>
                      <p className="text-xs text-slate-200/70">Choose a speaker and generate image</p>
                    </div>
                  )}

                  {showLoading && (
                    <div className="result-overlay result-animate absolute inset-0 z-30 grid place-items-center p-4">
                      <div className="loading-card">
                        <div className="loading-head">
                          <div className="loading-ring" aria-hidden="true" />
                          <div className="loading-copy">
                            <p className="loading-title">Generating image...</p>
                            <p className="loading-subtitle">Synthesizing visual output</p>
                          </div>
                        </div>
                        <div className="loading-bar" aria-hidden="true" />
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}

export default App
