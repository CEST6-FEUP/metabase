import { SAMPLE_DB_ID, USER_GROUPS } from "e2e/support/cypress_data";
import { SAMPLE_DATABASE } from "e2e/support/cypress_sample_database";
import type { StructuredQuestionDetails } from "e2e/support/helpers";
import { checkNotNull } from "metabase/lib/types";
import type {
  CollectionItem,
  Dashboard,
  FieldValue,
  Filter,
  GetFieldValuesResponse,
  ParameterValue,
  ParameterValues,
  StructuredQuery,
} from "metabase-types/api";

import type { DashcardQueryResponse, DatasetResponse } from "./types";

const { H } = cy;
const { ALL_USERS_GROUP, DATA_GROUP, COLLECTION_GROUP } = USER_GROUPS;
const { PRODUCTS_ID, ORDERS_ID, ORDERS, PRODUCTS } = SAMPLE_DATABASE;

type CustomColumnType = "boolean" | "string" | "number";
type CustomViewType = "Question" | "Model";

type SandboxPolicy = {
  filterTableBy: "column" | "custom_view";
  customViewType?: CustomViewType;
  customViewName?: string;
  customColumnType?: "number" | "string" | "boolean";
  filterColumn?: string;
};

const customColumnTypeToFormula: Record<CustomColumnType, string> = {
  boolean: '[Category]="Gizmo"',
  string: 'concat("Category is ",[Category])',
  number: 'if([Category] = "Gizmo", 1, 0)',
};

const addCustomColumnToQuestion = (customColumnType: CustomColumnType) => {
  cy.log("Add a custom column");
  H.getNotebookStep("expression").icon("add").click();
  H.enterCustomColumnDetails({
    formula: customColumnTypeToFormula[customColumnType],
    name: `my_${customColumnType}`,
  });
  H.popover().button("Done").click();
};

const baseQuery = {
  type: "query",
  "source-table": PRODUCTS_ID,
  limit: 20,
};

const gizmoFilter: Filter = ["=", ["field", PRODUCTS.CATEGORY, null], "Gizmo"];

export const questionCustomView: StructuredQuestionDetails = {
  name: "Question showing the products whose category is Gizmo (custom view)",
  query: {
    ...baseQuery,
    filter: gizmoFilter,
  },
};

export const modelCustomView: StructuredQuestionDetails = {
  name: "Model showing the products whose category is Gizmo (custom view)",
  query: {
    ...baseQuery,
    filter: gizmoFilter,
  },
  type: "model",
};

const customViews = [questionCustomView, modelCustomView];

const savedQuestion: StructuredQuestionDetails = {
  name: "Question showing all products",
  query: baseQuery,
};

const model: StructuredQuestionDetails = {
  name: "Model showing all products",
  query: baseQuery,
  type: "model",
};

const ordersJoinedToProducts: StructuredQuestionDetails = {
  name: "Question with Orders joined to Products",
  query: {
    ...baseQuery,
    joins: [
      {
        strategy: "left-join",
        alias: "Products",
        condition: [
          "=",
          ["field", ORDERS.PRODUCT_ID, null],
          ["field", PRODUCTS.ID, { "join-alias": "Products" }],
        ],
        "source-table": PRODUCTS_ID,
        fields: "all",
      },
    ],
    aggregation: [["sum", ["field", ORDERS.TOTAL, null]]],
    breakout: [["field", PRODUCTS.CATEGORY, { "join-alias": "Products" }]],
    "source-table": ORDERS_ID,
  } as StructuredQuery,
};

const ordersImplicitlyJoinedToProducts: StructuredQuestionDetails = {
  name: "Question with Orders implicitly joined to Products",
  query: {
    "source-table": ORDERS_ID,
    fields: [
      [
        "field",
        PRODUCTS.CATEGORY,
        { "base-type": "type/Text", "source-field": ORDERS.PRODUCT_ID },
      ],
      ["field", ORDERS.ID, null],
      ["field", ORDERS.TOTAL, null],
      ["field", ORDERS.PRODUCT_ID, null],
    ],
  },
};

const multiStageQuestion: StructuredQuestionDetails = {
  name: "Multi-stage question",
  query: {
    "source-query": {
      "source-query": {
        "source-table": PRODUCTS_ID,
        aggregation: [["count"]],
        breakout: [["field", PRODUCTS.CATEGORY, null]],
      },
      aggregation: [["count"]],
      breakout: [["field", PRODUCTS.CATEGORY, null]],
    },
    aggregation: [["count"]],
    breakout: [["field", PRODUCTS.CATEGORY, null]],
  },
};

const questionData: StructuredQuestionDetails[] = [
  savedQuestion,
  model,
  ordersJoinedToProducts,
  ordersImplicitlyJoinedToProducts,
  multiStageQuestion,
];

export const adhocQuestionData = {
  dataset_query: {
    database: SAMPLE_DB_ID,
    type: "query",
    query: {
      "source-table": PRODUCTS_ID,
    },
  },
};

function addCustomColumnsToQuestion() {
  H.openNotebook();
  H.getNotebookStep("data").button("Custom column").click();
  addCustomColumnToQuestion("boolean");
  addCustomColumnToQuestion("number");
  addCustomColumnToQuestion("string");
  H.visualize();

  // for some reason we can't use the saveQuestion helper here
  cy.intercept("PUT", "/api/card/*").as("updateQuestion");
  cy.findByTestId("qb-header").button("Save").click();
  H.modal().button("Save").click();
  cy.wait("@updateQuestion");
}

/**
 * creates all questions and models and puts them in a dashboard
 * all of them reside in a single collection
 */
export const createSandboxingDashboardAndQuestions = () => {
  customViews.forEach(view => H.createQuestion(view));

  H.createCollection({ name: "Sandboxing", alias: "sandboxingCollectionId" });

  return cy.get("@sandboxingCollectionId").then((collectionId: any) => {
    H.createDashboardWithQuestions({
      dashboardName: "Dashboard with sandboxable questions",
      dashboardDetails: { collection_id: collectionId },
      questions: questionData.map(questionDetails => ({
        ...questionDetails,
        collection_id: collectionId,
      })),
    }).then(({ dashboard, questions }) => {
      cy.log("Add question based on saved question");
      const savedQuestionId = questions.find(
        q => q.name === savedQuestion.name,
      )?.id;
      H.createQuestionAndAddToDashboard(
        {
          name: "Question based on the all-products question",
          query: {
            ...baseQuery,
            "source-table": `card__${savedQuestionId}`,
          },
          collection_id: collectionId,
        },
        dashboard.id,
      );

      cy.log("Add question based on model");
      const modelId = questions.find(q => q.name === model.name)?.id;
      H.createQuestionAndAddToDashboard(
        {
          name: "Question based on model",
          query: {
            ...baseQuery,
            "source-table": `card__${modelId}`,
          },
          collection_id: collectionId,
        },
        dashboard.id,
      );

      H.createQuestionAndAddToDashboard(
        {
          name: "Question with custom columns",
          query: baseQuery,
          collection_id: collectionId,
        },
        dashboard.id,
      ).then((response: any) => {
        H.visitQuestion(response.body.card.id);
        addCustomColumnsToQuestion();

        // copy custom column question to a model
        cy.request("GET", `/api/card/${response.body.card.id}`).then(
          ({ body }) => {
            cy.request("POST", "/api/card", {
              ...body,
              name: "Model with custom columns",
              type: "model",
            }).then(({ body }) => {
              H.addQuestionToDashboard({
                cardId: body.id,
                dashboardId: dashboard.id,
              });
            });
          },
        );
      });
    });

    // return the collection items
    return cy.request<{ data: CollectionItem[] }>(
      `/api/collection/${collectionId}/items`,
    );
  });
};

export const sandboxingUser = {
  email: "user@company.com",
  password: "--------",
  user_group_memberships: [
    { id: ALL_USERS_GROUP, is_group_manager: false },
    { id: DATA_GROUP, is_group_manager: false },
    { id: COLLECTION_GROUP, is_group_manager: false },
  ],
};

export const signInAsNormalUser = () => {
  cy.log(`Sign in as user via an API call: ${sandboxingUser.email}`);
  return cy.request("POST", "/api/session", {
    username: sandboxingUser.email,
    password: sandboxingUser.password,
  });
};

export const assignAttributeToUser = ({
  attributeKey = "filter-attribute",
  attributeValue,
}: {
  attributeKey?: string;
  attributeValue: string;
}) => {
  cy.request("GET", "/api/user")
    .then(response => {
      const userData = response.body.data.find(
        (user: { email: string }) => user.email === sandboxingUser.email,
      );
      return userData.id;
    })
    .then(userId => {
      return cy.request("GET", `/api/user/${userId}`);
    })
    .then(response => {
      const user = response.body;
      return user;
    })
    .then(user => {
      cy.request("PUT", `/api/user/${user.id}`, {
        ...user,
        login_attributes: {
          [attributeKey]: attributeValue,
        },
      });
    });
};

export const configureSandboxPolicy = (policy: SandboxPolicy) => {
  const { filterTableBy, customViewName, customViewType, filterColumn } =
    policy;

  cy.log(`Configure sandboxing policy: ${JSON.stringify(policy)}`);
  cy.log("Show the permissions configuration for the Sample Database");
  cy.visit("/admin/permissions/data/database/1");
  cy.log(
    "Show the permissions configuration for the Sample Database's Products table",
  );
  cy.findByRole("menuitem", { name: /Products/ }).click();
  cy.log("Modify the sandboxing policy for the 'data' group");
  H.modifyPermission("data", 0, "Sandboxed");

  H.modal().within(() => {
    cy.findByText(/Change access to this database to .*Sandboxed.*?/);
    cy.button("Change").click();
  });

  H.modal().findByText(/Restrict access to this table/);

  if (filterTableBy !== "custom_view") {
    cy.log("Filter by a column in the table");
    cy.findByRole("radio", {
      name: /Filter by a column in the table/,
    }).should("be.checked");
  } else if (customViewName) {
    cy.findByText(
      /Use a saved question to create a custom view for this table/,
    ).click();
    cy.findByTestId("custom-view-picker-button").click();
    H.entityPickerModal().within(() => {
      H.entityPickerModalTab(customViewType).click();
      cy.findByText(/Sandboxing/).click(); // collection name
      cy.findByText(customViewName).click();
    });
  }

  if (filterColumn) {
    H.modal()
      .findByRole("button", { name: /Pick a column|parameter/ })
      .click();
    cy.findByRole("option", { name: filterColumn }).click();
    H.modal()
      .findByRole("button", { name: /Pick a user attribute/ })
      .click();
    cy.findByRole("option", { name: "filter-attribute" }).click();
  }

  cy.log("Wait for the whole summary to render");
  cy.findByLabelText(/Summary/).contains("data");

  cy.log("Ensure the summary contains the correct text");
  cy.findByLabelText(/Summary/)
    .invoke("text")
    .should(summary => {
      expect(summary).to.contain("Users in data can view");
      if (filterColumn) {
        expect(summary).to.contain(`${filterColumn} field equals`);
      }
    });

  cy.log("Save the sandboxing modal");
  H.modal().findByRole("button", { name: "Save" }).click();

  H.saveChangesToPermissions();
};

const getQuestionDescription = (
  response: DatasetResponse,
  questions: CollectionItem[],
) => {
  // Extract the card ID from the response URL
  const cardId = Number(response?.url?.match(/\/card\/(\d+)/)?.[1]);
  const questionName = (questions.find(q => q.id === cardId) as any)?.name as
    | string
    | undefined;
  const query = JSON.stringify(response.body.json_query.query);
  const questionDesc = `${questionName} (query: ${query})`;
  return { questionDesc, questionName };
};

export function rowsShouldContainGizmosAndWidgets({
  responses,
  questions,
}: {
  responses: DatasetResponse[];
  questions: CollectionItem[];
}) {
  expect(responses.length).to.equal(questions.length);
  responses.forEach(response => {
    const { questionDesc } = getQuestionDescription(response, questions);
    expect(
      JSON.stringify(response.body),
      `No error in ${questionDesc}`,
    ).not.to.contain("stacktrace");
    expect(
      response.body.data.is_sandboxed,
      `Results are not sandboxed in ${questionDesc}`,
    ).to.be.false;
    const rows = response.body.data.rows;
    expect(
      rows.some(row => row.includes("Gizmo")),
      `Results include at least one Gizmo in ${questionDesc}`,
    ).to.be.true;

    expect(
      rows.some(
        row =>
          row.includes("Widget") ||
          row.includes("Gadget") ||
          row.includes("Doohickey"),
      ),
      `Results include at least one Widget, Gadget, or Doohickey in ${questionDesc}`,
    ).to.be.true;
  });
}

export function rowsShouldContainOnlyGizmos({
  responses,
  questions,
}: {
  responses: DatasetResponse[];
  questions: CollectionItem[];
}) {
  expect(responses.length).to.equal(questions.length);

  responses.forEach(response => {
    const { questionDesc } = getQuestionDescription(response, questions);
    cy.log(`Results contain only Gizmos in: ${questionDesc}`);
    expect(response?.body.data.is_sandboxed).to.be.true;

    const rows = response.body.data.rows;

    expect(
      rows.every(
        row =>
          row.includes("Gizmo") ||
          // With implicit joins, some rows might have a null product
          row[0] === null,
      ),
      `Every result should have have a Gizmo in: ${questionDesc}`,
    ).to.be.true;
    expect(
      !rows.some(row => row.includes("Widget")),
      `No results should have Widgets in: ${questionDesc}`,
    ).to.be.true;
  });
}

export const valuesShouldContainGizmosAndWidgets = (
  valuesArray: (FieldValue | ParameterValue)[],
) => {
  const values = valuesArray.map(val => val[0]);
  expect(values).to.contain("Gizmo");
  expect(values).to.contain("Widget");
};

export const valuesShouldContainOnlyGizmos = (
  valuesArray: (FieldValue | ParameterValue)[],
) => {
  const values = valuesArray.map(val => val[0]);
  expect(values).to.deep.equal(["Gizmo"]);
};

export const getDashcardResponses = (
  dashboard: Dashboard | null,
  questions: CollectionItem[],
) => {
  signInAsNormalUser();

  H.visitDashboard(checkNotNull(dashboard).id);

  expect(questions.length).to.be.greaterThan(0);
  return cy
    .wait(new Array(questions.length).fill("@dashcardQuery"))
    .then(interceptions => {
      const responses = interceptions.map(
        i => i.response as unknown as DashcardQueryResponse,
      );
      return { questions, responses };
    });
};

export const getCardResponses = (questions: CollectionItem[]) => {
  expect(questions.length).to.be.greaterThan(0);
  return H.cypressWaitAll(
    questions.map(question =>
      cy.request<DatasetResponse>("POST", `/api/card/${question.id}/query`),
    ),
  ).then(responses => {
    return { responses: responses, questions: questions };
  }) as Cypress.Chainable<{
    responses: DatasetResponse[];
    questions: CollectionItem[];
  }>;
};

export const getFieldValuesForProductCategories = () =>
  cy.request<GetFieldValuesResponse>(
    "GET",
    `/api/field/${PRODUCTS.CATEGORY}/values`,
  );

export const getParameterValuesForProductCategories = () =>
  cy.request<ParameterValues>("POST", "/api/dataset/parameter/values", {
    parameter: {
      id: "1234",
      name: "Text",
      slug: "text",
      type: "string/=",
      values_query_type: "list",
      values_source_type: null,
      values_source_config: {},
    },
    field_ids: [SAMPLE_DATABASE.PRODUCTS.CATEGORY],
  });
