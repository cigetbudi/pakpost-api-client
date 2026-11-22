using Pakpost.Api.Extensions;

var builder = WebApplication.CreateBuilder(args);

// All policy and service registration lives in dedicated composition extensions.
builder.ConfigurePakpostHost();
builder.Services.AddPakpostServices(builder.Configuration);

var app = builder.Build();
app.UsePakpostRequestPipeline();
app.MapPakpostEndpoints();
app.Run();
