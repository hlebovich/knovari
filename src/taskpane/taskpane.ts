/* global PowerPoint console */
export async function getSelectedShapeInfo() {
  try {
    await PowerPoint.run(async (context) => {
      const selection = context.presentation.getSelectedShapes();
      selection.load("items"); // Load the items (individual shapes) in the collection
      await context.sync();

      console.log(`shapes count: ${selection.items.length}`);

      for (const shape of selection.items) {
        shape.load("id, name, type"); // Load desired properties of each shape
        await context.sync();

        console.log(`Shape ID: ${shape.id}, Name: ${shape.name}, Type: ${shape.type}`);
      }
    });
  } catch (error) {
    console.log("Error: " + error);
  }
}
export async function getInfo() {
  try {
    await PowerPoint.run(async (context) => {
      const slides = context.presentation.slides;
      slides.load("items"); // Load the items (individual slides) in the collection
      await context.sync();

      console.log(`slides count: ${slides.items.length}`);

      for (const slide of slides.items) {
        slide.load("id,index,shapes"); // Load desired properties of each slide
        await context.sync();

        console.log(`Slide ID: ${slide.id}, Index: ${slide.index}`);
      }
      console.log(`Trying to get: ${slides.items[0].id}`);
      const slide = await context.presentation.slides.getItemOrNullObject("256#2465795940");
      console.log(`Slide ${slides.items[0].id}: `, slide);

      console.log(Office.context.document);
      // await Office.context.document.goToByIdAsync(
      //   slides.items[0].id,
      //   Office.GoToType.Slide,
      //   (result) => {
      //     if (result.status === Office.AsyncResultStatus.Succeeded) {
      //       console.log("Navigation to slide succeeded.");
      //     } else {
      //       console.error("Navigation to slide failed: " + result.error.message);
      //     }
      //   }
      // );
    });
  } catch (error) {
    console.log("Error: " + error);
  }
}

export async function goToSlide(slideId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Office.context.document.goToByIdAsync("256#2465795940", Office.GoToType.Slide, (res) => {
      if (res.status === Office.AsyncResultStatus.Succeeded) {
        resolve();
      } else {
        console.warn("[NAV] goToSlideById failed", { slideId, error: res.error });
        reject(res.error);
      }
    });
  });
}
