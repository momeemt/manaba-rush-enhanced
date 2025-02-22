"use strict"

import { getStorage, setStorage } from "../network/storage"
import type { SeasonCode, ModuleCode } from "../types/filterCources"

import { checkLang } from "./checkLang"

let lang: checkLang.langCode

export const filterCourses = (): void => {
  lang = checkLang()

  const moduleSelector = createModuleSelector()

  getStorage({
    kind: "sync",
    keys: "filterConfigForModule",
    callback: (storage) => {
      if (storage.filterConfigForModule) {
        moduleSelector.value = storage.filterConfigForModule as ModuleCode
        applyFilter(storage.filterConfigForModule)
      }
    },
  })

  moduleSelector.addEventListener("change", (e) => {
    if (e.target) {
      const curModuleCode = (e.target as HTMLSelectElement).value as ModuleCode
      applyFilter(curModuleCode)

      setStorage({
        kind: "sync",
        items: {
          filterConfigForModule: curModuleCode,
        },
      })
    }
  })
}

/**
 * Parse module code
 * @param {string} moduleCode Module code: {season-module}
 */
const parseModuleCode = (
  moduleCode: ModuleCode
): { season: SeasonCode; module: ModuleCode } => {
  const season = moduleCode.split("-")[0] as SeasonCode
  const module = moduleCode.split("-")[1] as ModuleCode

  return { season, module }
}

/**
 * Convert season code to the text for UI according to the display language
 * @param {string} seasonCode "spring" or "autumn"
 * @return {string} "春", "Spring", etc...
 */
const seasonCodeToText = (seasonCode: SeasonCode) => {
  switch (seasonCode) {
    case "spring": {
      if (lang === "ja") {
        return "春"
      } else if (lang === "en") {
        return "Spring"
      } else {
        return ""
      }
    }
    case "autumn": {
      if (lang === "ja") {
        return "秋"
      } else if (lang === "en") {
        return "Autumn"
      } else {
        return ""
      }
    }
  }
}

const createModuleSelector = () => {
  const selectorsContainer = document.querySelector(
    ".my-infolist-mycourses .showmore"
  )

  const moduleSelector = document.createElement("select")
  moduleSelector.name = "select"

  const moduleCodes: ModuleCode[] = [
    "all",
    "spring-a",
    "spring-b",
    "spring-c",
    "autumn-a",
    "autumn-b",
    "autumn-c",
  ]

  const moduleCodeToText = (moduleCode: ModuleCode) => {
    if (moduleCode === "all") {
      if (lang === "ja") {
        return "すべてのモジュール"
      } else if (lang === "en") {
        return "All modules"
      }
    }

    const parsedModuleCode = parseModuleCode(moduleCode)

    const season = seasonCodeToText(parsedModuleCode.season)

    return `${season}${parsedModuleCode.module.toUpperCase()}`
  }

  moduleCodes.forEach((moduleCode: ModuleCode) => {
    const optionDom = document.createElement("option")
    optionDom.value = moduleCode
    optionDom.innerText = moduleCodeToText(moduleCode)
    if (moduleCode === "all") {
      optionDom.setAttribute("selected", "true")
    }

    moduleSelector.appendChild(optionDom)
  })

  if (selectorsContainer) {
    selectorsContainer.insertBefore(
      moduleSelector,
      selectorsContainer.childNodes[0]
    )
  }

  return moduleSelector
}

const applyFilter = (moduleCode: ModuleCode): void => {
  let viewMode: "list" | "thumbnail"
  let courses: HTMLElement[]

  const coursesListContainer = document.querySelector(".courselist tbody")
  const coursesThumbnailContainer = document.querySelector(
    ".mycourses-body .section"
  )

  if (coursesListContainer) {
    viewMode = "list"

    courses = Array.from(coursesListContainer.children) as HTMLElement[]
    courses.shift()
  } else if (coursesThumbnailContainer) {
    viewMode = "thumbnail"

    courses = Array.from(coursesThumbnailContainer.children) as HTMLElement[]
    courses.pop()
  } else {
    throw "invalid viewMode"
  }

  /**
   * Parse course info string on the UI
   * @param {string} courseInfoString Something like "秋A 水5,6" or "Spring AB Mon. 2"
   * @return {{ season: Object.<string, boolean>, module: Array.<string>, dayOfWeek: Object.<string, boolean>, period: Array.<string>}}
   */
  const parseCourseInfoString = (
    courseInfoString: string
  ): {
    season: { [key in SeasonCode]: boolean }
    module: string[]
  } | void => {
    if (lang === "ja") {
      const courseInfoRegex = /^([春秋])([abc]+)/i

      if (courseInfoRegex.test(courseInfoString)) {
        const match = courseInfoString.match(courseInfoRegex)

        if (match) {
          const [, season, module] = match

          return {
            season: {
              spring: season.includes("春"),
              autumn: season.includes("秋"),
            },
            module: module.split("").map((str) => str.toLowerCase()),
          }
        }
      }
    } else if (lang === "en") {
      const courseInfoRegex = /^(Spring|Autumn)\s([abc]+)/i

      if (courseInfoRegex.test(courseInfoString)) {
        const match = courseInfoString.match(courseInfoRegex)

        if (match) {
          const [, season, module] = match

          return {
            season: {
              spring: season === "Spring",
              autumn: season === "Autumn",
            },
            module: module.split("").map((str) => str.toLowerCase()),
          }
        }
      }
    } else {
      throw "invalid lang"
    }
  }

  let isOddRow = true

  const handleOddRow = (course: HTMLElement) => {
    if (isOddRow) {
      course.classList.replace("row0", "row1")
    } else {
      course.classList.replace("row1", "row0")
    }
    isOddRow = !isOddRow
  }

  const showCourse = (course: HTMLElement) => {
    if (viewMode === "list") {
      course.style.display = "table-row"
      handleOddRow(course)
    } else if (viewMode === "thumbnail") {
      course.style.display = "block"
    }
  }

  const hideCourse = (course: HTMLElement) => {
    course.style.display = "none"
  }

  if (moduleCode !== "all") {
    const parsedModuleCode = parseModuleCode(moduleCode)

    courses.forEach((course) => {
      let courseInfoString: string

      if (viewMode === "list") {
        course.style.display = "table-row"
      }

      if (viewMode === "list") {
        courseInfoString = (course.children[2] as HTMLElement)
          .innerText as string
      } else if (viewMode === "thumbnail") {
        const courseInfoStringElm = course.querySelector(
          ".courseitemdetail-date span"
        ) as HTMLElement

        if (courseInfoStringElm) {
          courseInfoString = courseInfoStringElm.title
        } else {
          courseInfoString = ""
        }
      } else {
        throw "invalid viewMode"
      }

      if (/^.+\s.+$/.test(courseInfoString)) {
        const courseInfo = parseCourseInfoString(courseInfoString)

        if (
          courseInfo &&
          courseInfo.season[parsedModuleCode.season] &&
          courseInfo.module.includes(parsedModuleCode.module)
        ) {
          showCourse(course)
        } else {
          hideCourse(course)
        }
      } else {
        showCourse(course)
      }
    })
  } else {
    courses.forEach((course) => {
      showCourse(course)
    })
  }
}
