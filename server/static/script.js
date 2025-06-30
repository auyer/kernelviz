async function get_commits(window_size){
		result = await fetch(`/api/commits?window_size=${window_size}`)
    json_commits = await result.json()

    return json_commits
}

async function getTags(){
    result = await fetch("/api/tags")
    jsonTags = await result.json()
    return jsonTags
}

// Create Vue app after the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = Vue.createApp({
        data() {
            return {
                branchData: {
                    leftDataPoints: [],
                    rightDataPoints: [],
                    allData: {},
                    commitDates: [],
                    tags: [],
                    showTags: false,
                    overRatio: 'LoC Changes',
                    underRatio: 'Committers',
                    showRatio: false
                },
                windowSize: '14',
                collectedCommits: null,
                collectedTags: null,
                resizeTimeout: null,
                isLoading: false
            }
        },
        mounted() {
            // Add resize event listener
            window.addEventListener('resize', this.handleResize);
        },
        beforeUnmount() {
            // Clean up resize event listener
            window.removeEventListener('resize', this.handleResize);
        },
        methods: {
            handleResize() {
                // Debounce resize events
                if (this.resizeTimeout) {
                    clearTimeout(this.resizeTimeout);
                }
                this.resizeTimeout = setTimeout(() => {
                    const plotDiv = document.getElementById('plotDiv');
                    if (plotDiv) {
                        Plotly.Plots.resize(plotDiv);
                    }
                }, 250); // 250ms debounce
            },
            replotOnToggle() {
                this.plot_figure();
            },
            toggleCustomRatio() {
                this.plot_figure();
            },
            updateOver() {
                this.plot_figure();
            },
            updateUnder() {
                this.plot_figure();
            },
            async updateWindowLen() {
								this.isLoading = true;
                try {
									await this.fetchData(this.windowSize);
									await this.computeBranchData();
									await this.plot_figure();
                } catch (error) {
                    console.error('Error rewindowing data:', error);
                } 
								this.isLoading = false;
            },
						async fetchData(window) {
                try {
                    // get commits and tags in parallel
										const [commits, tags] = await Promise.all([get_commits(window), getTags()]);
                    this.collectedTags = tags;
                    this.collectedCommits = commits;
                } catch (error) {
                    console.error('Error initializing data:', error);
                } finally {
                    this.isLoading = false;
                }
						},
            async initializeData() {
								// Wait for next tick to ensure DOM is ready
								await this.$nextTick();
                try {
                    this.isLoading = true;
										await this.fetchData(this.windowSize);

										let dates = this.collectedCommits["committer_date"];
					
										this.branchData = {
												leftDataPoints: ['Authors','Committers'],
												rightDataPoints: ['LoC Net'],
												allData: {},
												commitDates: [],
												tags: this.collectedTags,
												showTags: false,
												overRatio: 'LoC Changes',
												underRatio: 'Committers',
												showRatio: false
										};
                    await this.computeBranchData();
                    await this.plot_figure();
                } catch (error) {
                    console.error('Error initializing data:', error);
                } finally {
                    this.isLoading = false;
                }
            },
            async computeBranchData() {
                if (!this.collectedCommits) {
                    console.error('Commits not initialized');
                    return;
                }

                const allData = {
										// Absolute values
                    'Maintainers Listed': {'axisLabel': 'Contributions', 'data': this.collectedCommits["declared_maintainers"]},
                    'LoC Added': {'axisLabel': 'LoC', 'data': this.collectedCommits["insertions"]},
                    'LoC Removed': {'axisLabel': 'LoC', 'data': this.collectedCommits["deletions"]},
                    'LoC Net': {'axisLabel': 'LoC', 'data': this.collectedCommits["net_line_change"]},
                    'LoC Changes': {'axisLabel': 'LoC', 'data': this.collectedCommits["total_line_change"]},
                    'Commits': {'axisLabel': 'Contributions', 'data': this.collectedCommits["number_of_commits"]},

									// Rolling sums
                    'Authors': {'axisLabel': 'Contributions', 'data': this.collectedCommits["rolling_count_authors"]},
                    'Committers': {'axisLabel': 'Contributions', 'data': this.collectedCommits["rolling_count_committers"]},
                    'Reviewed Bys': {'axisLabel': 'Contributions', 'data': this.collectedCommits["attributions_reviewed"]},
                    'Tested Bys': {'axisLabel': 'Contributions', 'data': this.collectedCommits["attributions_tested"]},
                    'Suggested Bys': {'axisLabel': 'Contributions', 'data': this.collectedCommits["attributions_suggested"]},
                    'Reported Bys': {'axisLabel': 'Contributions', 'data': this.collectedCommits["attributions_reporetd"]},
                    "ACK'd Bys": {'axisLabel': 'Contributions', 'data': this.collectedCommits["attributions_ack"]},
                    'Authoring Maintainers': {'axisLabel': 'Contributions', 'data': this.collectedCommits["rolling_count_contributors"]},
                    'Supporting Maintainers': {'axisLabel': 'Contributions', 'data': this.collectedCommits["rolling_count_extra_contributors"]},
                };

								let dates = this.collectedCommits["committer_date"];
							
								this.branchData.allData = allData;
								this.branchData.commitDates = dates;
            },
            async plot_figure() {
                // Wait for next tick to ensure DOM is ready
                await this.$nextTick();
                try {
                    const plotDiv = document.getElementById('plotDiv');
                    if (!plotDiv) {
                        console.error('Plot div not found');
                        return;
                    }

                    const xData = this.branchData.commitDates;
                    if (!xData || xData.length === 0) {
                        console.error('No data available for plotting');
                        return;
                    }

										const Authors = this.branchData.allData["Authors"]
                    const dummyTrace = {
                        x: xData,
                        y: [null],
                        type: 'scatter',
                        mode: 'lines',
                        yaxis: 'y',
                        showlegend: false,
                        hoverinfo: 'none',
                        visible: true
                    }

                    var data = [];
										let leftAxisLabel;
										let rightAxisLabel;

										
										for(const leftKey of this.branchData.leftDataPoints) {
												if (!this.branchData.allData[leftKey]) {
														console.warn(`No data available for ${leftKey}`);
														continue;
												}
												data.push({
														x: xData,
														y: this.branchData.allData[leftKey]['data'],
														type: 'lines',
														yaxis: 'y',
														name: leftKey
												})
												leftAxisLabel = this.branchData.allData[leftKey]['axisLabel'];
										}

										if(this.branchData.leftDataPoints.length === 0) {
												data.push(dummyTrace);
										}
										for(const rightKey of this.branchData.rightDataPoints) {
												if (!this.branchData.allData[rightKey]) {
														console.warn(`No data available for ${rightKey}`);
														continue;
												}
												data.push({
														x: xData,
														y: this.branchData.allData[rightKey]['data'],
														type: 'lines',
														yaxis: 'y2',
														name: rightKey
												})
												rightAxisLabel = this.branchData.allData[rightKey]['axisLabel'];
										}

										const tagShapes = []
										const tagLabels = []

                    if(this.branchData.showTags) {
                        for(const datedTag of this.branchData.tags) {
														try{
															// skip tags outside commit time window presented in graph
															if (!(datedTag["date"] > xData[0] && datedTag["date"] < xData[xData.length-1])){
																continue;
															}
															const tagDate = datedTag["date"].split(" ")[0];

															const newShape = {
																	type: 'line',
																	x0: tagDate,
																	x1: tagDate,
																	y0: 0,
																	y1: 1,
																	xref: 'x',
																	yref: 'paper',
																	line: {color: 'skyBlue', width: 2, dash: 'dot' }
															};

															const newLabel = {
																	type: 'line',
																	x: tagDate,
																	y: 1.05,
																	xref: 'x',
																	yref: 'paper',
																	text: datedTag["tag"],
																	textangle: -90,
																	showarrow: false,
																	xanchor: 'center',
																	yanchor: 'bottom',
																	line: {color: 'skyBlue', width: 1, dash: 'dot' }
															}

															tagShapes.push(newShape);
															tagLabels.push(newLabel);
													} catch (error) {
															console.error('reading tag:', error);
													}
                        }
                    }

                    if(this.branchData.showRatio) {
                        const ratioValues = [];
                        const overKey = this.branchData.overRatio;
                        const underKey = this.branchData.underRatio;

                        if (!this.branchData.allData[overKey] || !this.branchData.allData[underKey]) {
                            console.warn('Missing data for ratio calculation');
                        } else {
                            for(let i in xData) {
                                const overVal = this.branchData.allData[overKey]['data'][i];
                                const underVal = this.branchData.allData[underKey]['data'][i];

                                if(underVal == 0) {
                                    if(i > 0) {
                                        ratioValues.push(ratioValues[i-1]);
                                    } else {
                                        ratioValues.push(0);
                                    }
                                } else {
                                    ratioValues.push(overVal/underVal);
                                }
                            }

                            data.push({
                                x: xData,
                                y: ratioValues,
                                type: 'lines',
                                yaxis: 'y3',
                                line: { color: 'red', width: 2, dash: 'dot' },
                                name: "Ratio " + overKey + " over " + underKey
                            })
                        }
                    }

                    var layout = {
                        xaxis: {
                            title: 'Date',
                            type: 'date'
                        },
                        yaxis: {
                            title: leftAxisLabel
                        },
                        yaxis2: {
                            title: rightAxisLabel,
                            overlaying: 'y',
                            side: 'right',
                            anchor: 'x',
                            showgrid: false,
                        },
                        yaxis3: {
                            overlaying: 'y',
                            side: 'left',
                            rangemode: 'tozero',
                            anchor: 'x',
                            zeroline: false,
                            showgrid: false,
                            showticklabels: false
                        },
                        shapes: tagShapes,
                        annotations: tagLabels
                    };

                    await Plotly.newPlot('plotDiv', data, layout);
                } catch (error) {
                    console.error('Error plotting figure:', error);
                } finally {
                    this.isLoading = false;
                }
            }
        }
    });

    // Mount Vue app
    const vm = app.mount('#app');

    // Initialize data
    vm.initializeData();
});
