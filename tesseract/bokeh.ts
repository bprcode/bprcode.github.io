import './bokeh.css'
type Vec3 = [number, number, number]

class BokehEffect {
  sceneContainer?: HTMLElement = undefined
  count = 18
  particleDivs: HTMLDivElement[] = []
  positions: Vec3[] = []
  velocities: Vec3[] = []
  focalDepths: number[] = []
  isActive: boolean[] = []
  isFresh: boolean[] = []
  particleAge: number[] = []
  particleLifetime: number[] = []
  circulationStrength: number[] = []
  vignetteFactor: number[] = []
  frameCountdown:number[] =[]
  tLast = 0
  zCenter = 8
  beamAngle = 0

  // Soft clipping boundaries for particle fade-out:
  nearFence = 0.5
  xFence = 1.25
  riseFence = 3.0
  dropFence = 0.25
  blackHoleSize = 0.5
  focalFence = 0.15

  constructor(container?: HTMLElement | null) {
    this.animate = this.animate.bind(this)
    this.sceneContainer = container ?? undefined

    this.initAnimation()
  }

  initAnimation() {
    if (!this.sceneContainer) {
      throw new Error('Cannot initialize bokeh animation: no scene container.')
    }

    this.positions = Array.from({ length: this.count }, () => [0, 0, 0])
    this.velocities = Array.from({ length: this.count }, () => [0, 0, 0])
    this.focalDepths = Array(this.count).fill(0)
    this.frameCountdown = Array(this.count).fill(0)
    this.particleAge = Array(this.count).fill(0)
    this.particleLifetime = Array(this.count).fill(0)
    this.vignetteFactor = Array(this.count).fill(0)
    this.isActive = Array(this.count).fill(false)
    this.isFresh = Array(this.count).fill(false)
    this.circulationStrength = Array(this.count).fill(1)

    for (let i = 0; i < this.count; i++) {
      const div = document.createElement('div')

      div.classList.add('bokeh-particle')
      this.particleDivs.push(div)

      this.sceneContainer.append(div)
    }

    let ramp = 0
    const rampUpTid = setInterval(() => {
      this.startParticle(ramp)
      ramp++
      if (ramp === this.count) {
        clearInterval(rampUpTid)
      }
    }, 3000 / this.count)

    requestAnimationFrame(this.animate)
  }

  startParticle(i: number) {
    this.particleAge[i] = 0
    this.particleLifetime[i] = 2
    this.frameCountdown[i] = 0.125
    const focusTime = 2

    this.isActive[i] = true
    this.isFresh[i] = true

    // Create eccentric particle:
    if (Math.random() > 0) {
      // debug, no circular particles
      const z =
        Math.random() ** 2 * (this.nearFence * 20) +
        this.zCenter -
        this.nearFence * 0.25
      const x = z * (Math.random() - 0.5) * 2
      const y = z * (Math.random() - 0.65) * 0.65

      this.positions[i] = [x, y, z]
      this.velocities[i] = [
        Math.random() * -this.positions[i][0] * 0.01 +
          (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.125) * 1,
        Math.random() - 0.25,
      ]

      this.circulationStrength[i] = 0 * Math.random() ** 2
    } else {
      // Create standard particle:

      const fuzz =
        Math.random() > 0.5 ? Math.random() ** 2 : -(Math.random() ** 2)
      const angle =
        (Math.PI * 2 * (Date.now() % 8000)) / 8000 + (fuzz * Math.PI) / 1.5
      const radius =
        this.blackHoleSize * Math.random() ** 2 +
        Math.sqrt(this.blackHoleSize) * 1.5
      this.positions[i] = [
        radius * Math.cos(angle),
        (Math.random() - 0.5) * 3,
        this.zCenter + radius * Math.sin(angle),
      ]
      // this.velocities[i]=[0,0,0]
      this.velocities[i] = cross(
        [
          this.positions[i][0],
          this.positions[i][1],
          this.positions[i][2] - this.zCenter,
        ],
        [0, -1, 0]
      )
      const period = Math.random() * 12 + 8
      this.velocities[i] = scale(this.velocities[i], (1 / radius) * 0.5)
      this.velocities[i] = scale(
        this.velocities[i],
        (2 * Math.PI * radius) / period
      )

      this.velocities[i][1] += (Math.random() - 0.5) * 1
      this.velocities[i][2] += (Math.random() - 0.5) * 2

      this.circulationStrength[i] = 1.0
    }

    this.focalDepths[i] =
      this.positions[i][2] + focusTime * this.velocities[i][2]

    this.particleDivs[i].style.setProperty('--rot', Math.floor(Math.random()*360)+'deg')
    this.particleDivs[i].style.setProperty(
      '--hue',
      Math.random() > 0.5
        ? String(220 + Math.floor(Math.random() * 20))
        : String(180 + Math.floor(Math.random() * 20))
    )
    // Vignette:
    this.vignetteFactor[i] =
      0.09 * (1 - (this.positions[i][0] / this.positions[i][2]) ** 2)

    // DEBUG - override velocities
    this.velocities[i] = [0, 0, 0]

    setTimeout(() => {
      this.isFresh[i] = false
    }, 2000)
  }

  isOutOfFrame(i: number): boolean {
    if (
      this.particleLifetime[i] < 0 ||
      Math.abs(this.positions[i][0] / this.positions[i][2]) > this.xFence ||
      this.positions[i][1] / Math.abs(this.positions[i][2]) > this.dropFence ||
      this.positions[i][1] < -this.riseFence ||
      this.positions[i][2] < this.zCenter - this.nearFence ||
      Math.abs(this.positions[i][2] - this.focalDepths[i]) > this.focalFence ||
      this.positions[i][0] ** 2 +
        this.positions[i][1] ** 2 +
        (this.positions[i][2] - this.zCenter) ** 2 <
        this.blackHoleSize
    ) {
      return true
    }

    return false
  }

  animate(t: number) {
    this.tLast ??= t

    // Discard large steps to limit nonlinearity:
    if (t - this.tLast > 100) {
      this.tLast = t
    }

    const dt = (t - this.tLast) / 1000
    this.tLast = t

    this.beamAngle = (this.beamAngle + dt) % (Math.PI * 2)

    for (let i = 0; i < this.count; i++) {
      // const wind = this.wind(
      //   this.positions[i],
      //   this.velocities[i],
      //   this.circulationStrength[i]
      // )

      // this.velocities[i][0] += wind[0] * dt
      // this.velocities[i][1] += wind[1] * dt
      // this.velocities[i][2] += wind[2] * dt

      this.positions[i][0] += this.velocities[i][0] * dt
      this.positions[i][1] += this.velocities[i][1] * dt
      this.positions[i][2] += this.velocities[i][2] * dt

      this.particleAge[i] += dt
      this.particleLifetime[i] -= dt
      this.frameCountdown[i] -= dt
      if(this.frameCountdown[i] > 0) {
        continue
      }

      // const centerFade = 1
      const centerFade = Math.min(1, Math.abs(2*this.positions[i][0] / this.positions[i][2]))
      const focalDelta = Math.abs(this.positions[i][2] - this.focalDepths[i])
      const beamBoost =
        (this.positions[i][0] * Math.cos(this.beamAngle) +
          (this.positions[i][2] - this.zCenter) * Math.sin(this.beamAngle)) /
        Math.sqrt(this.positions[i][0] ** 2 + this.positions[i][1]**2 + this.positions[i][2] ** 2)
      const boost = Math.max(0, beamBoost) ** 2

      this.particleDivs[i].style.setProperty(
        '--blur-radius',
        Math.max(1, Math.min(32, Math.floor(32 * (1 - boost)))) + 'px'
      )

      this.particleDivs[i].style.setProperty(
        '--lightness',
        50 + 30 * boost + '%'
      )

      if (this.isFresh[i]) {
        const fadeIn = Math.min(1, this.particleAge[i] / 2)
        this.particleDivs[i].style.setProperty(
          '--shine-alpha',
          String(
            fadeIn *
              (1 - focalDelta) *
              this.vignetteFactor[i] *
              centerFade *
              (1 + 3 * boost)
            // fadeIn * this.vignetteFactor[i] *centerFade +
            // fadeIn * boost * 0.5
          )
        )
      } else if (this.isActive[i]) {
        this.particleDivs[i].style.setProperty(
          '--shine-alpha',
          String(
            (1 - focalDelta) *
              this.vignetteFactor[i] *
              centerFade *
              (1 + 3 * boost)
          )
          // String(this.vignetteFactor[i]*centerFade+boost * 0.5)
        )
      } else {
        const fadeOut = Math.max(0, 1 - this.particleAge[i] / 2)
        this.particleDivs[i].style.setProperty(
          '--shine-alpha',
          String(
            fadeOut *
              (1 - focalDelta) *
              this.vignetteFactor[i] *
              centerFade *
              (1 + 3 * boost)
            // this.vignetteFactor[i]*centerFade+
            // fadeOut * boost * 0.5
          )
        )
      }

      if (!this.isFresh[i] && this.isActive[i] && this.isOutOfFrame(i)) {
        this.isActive[i] = false
        this.particleAge[i] = 0

        setTimeout(() => {
          this.startParticle(i)
        }, 2000)
      }
    }

    for (let i = 0; i < this.count; i++) {
      if(this.frameCountdown[i] > 0) {
        continue
      } else {
        this.frameCountdown[i] += 0.125
      }

      const rotated = rotX(3.14 / 8, [
        this.positions[i][0],
        this.positions[i][1],
        this.positions[i][2] - this.zCenter,
      ])
      rotated[2] += this.zCenter

      this.particleDivs[i].style.setProperty('--x', String(rotated[0]))
      this.particleDivs[i].style.setProperty('--y', String(rotated[1]))
      this.particleDivs[i].style.setProperty('--z', String(rotated[2]))
    }

    requestAnimationFrame(this.animate)
  }

  outwardForce(position: Vec3): Vec3 {
    const rSquared =
      position[0] ** 2 + position[1] ** 2 + (position[2] - this.zCenter) ** 2
    return [
      position[0] / rSquared,
      position[1] / rSquared,
      (position[2] - this.zCenter) / rSquared,
    ]
  }

  wind(position: Vec3, velocity: Vec3, circulationFactor: number): Vec3 {
    const radius = Math.sqrt(
      position[0] ** 2 + position[1] ** 2 + (position[2] - this.zCenter) ** 2
    )
    // Limit centripetal force strength to avoid singularity behavior:
    const boundedRadius = Math.max(2 * this.blackHoleSize, radius)
    const magCircular =
      (velocity[0] ** 2 + velocity[1] ** 2 + velocity[2] ** 2) / boundedRadius
    const uCentripetal = [
      -position[0] / boundedRadius,
      -position[1] / boundedRadius,
      (this.zCenter - position[2]) / boundedRadius,
    ]

    const gravity = 0.05

    const fCircular = [
      circulationFactor * magCircular * uCentripetal[0],
      circulationFactor * magCircular * uCentripetal[1],
      circulationFactor * magCircular * uCentripetal[2],
    ]

    return [fCircular[0], fCircular[1] + gravity, fCircular[2]]
  }
}

function scale(v: Vec3, t: number): Vec3 {
  return [v[0] * t, v[1] * t, v[2] * t]
}

function cross(u: Vec3, v: Vec3): Vec3 {
  return [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ]
}

function rotX(theta: number, original: Vec3): Vec3 {
  return [
    original[0],
    original[1] * Math.cos(theta) - original[2] * Math.sin(theta),
    original[1] * Math.sin(theta) + original[2] * Math.cos(theta),
  ]
}

const effects: BokehEffect[] = []

for (const container of document.querySelectorAll('.bokeh-container')) {
  effects.push(new BokehEffect(container as HTMLElement))
}
